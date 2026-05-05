// Client-side only. Uses Web Audio API directly to avoid Tone.js bundling
// issues in Next.js (the tone package's class exports are unreliable across
// webpack's ESM→CJS transpilation boundary).
import { Midi } from "@tonejs/midi";

interface ScheduledNote {
  freq: number;
  time: number;   // seconds from song start
  duration: number;
  velocity: number;
}

// Midi note number → Hz (equal temperament, A4 = 440 Hz)
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Note name like "C4", "F#3" → MIDI number
function nameToMidi(name: string): number {
  const NOTE: Record<string, number> = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
    E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
    Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
  };
  const m = name.match(/^([A-G][b#]?)(-?\d+)$/);
  if (!m) return 60;
  return (parseInt(m[2]) + 1) * 12 + (NOTE[m[1]] ?? 0);
}

export class TonePlayer {
  private ctx: AudioContext | null = null;
  private notes: ScheduledNote[] = [];
  private _duration: number = 0;
  private _speed: number = 1;
  private _loop: boolean = false;
  private _loaded: boolean = false;

  // Playback state tracked via AudioContext time
  private _playing: boolean = false;
  private _playStartCtxTime: number = 0; // ctx.currentTime when play() was called
  private _playStartSongTime: number = 0; // song seconds at that moment
  private _activeNodes: AudioNode[] = [];
  private _endTimer: ReturnType<typeof setTimeout> | null = null;

  async load(url: string): Promise<void> {
    this._stop();

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const midi = new Midi(buf);

    this._duration = midi.duration;
    this.notes = [];
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        this.notes.push({
          freq: midiToFreq(nameToMidi(note.name)),
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
        });
      }
    }

    this._loaded = true;
  }

  private _ctx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  // Schedule all notes that start at or after `songOffset` seconds
  private _scheduleNotes(songOffset: number): void {
    this._clearNodes();
    const ctx = this._ctx();
    const now = ctx.currentTime;
    const s = this._speed;

    for (const note of this.notes) {
      const noteRelTime = note.time / s - songOffset / s;
      if (noteRelTime < -0.05) continue; // already past

      const startAt = Math.max(now, now + noteRelTime);
      const stopAt = startAt + Math.max(note.duration / s, 0.05);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.value = note.freq;

      const vol = note.velocity * 0.25;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(vol, startAt + 0.005);
      gain.gain.setValueAtTime(vol, startAt + Math.max(note.duration / s - 0.05, 0.005));
      gain.gain.linearRampToValueAtTime(0, stopAt);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(stopAt + 0.01);

      this._activeNodes.push(osc, gain);
    }
  }

  private _clearNodes(): void {
    for (const node of this._activeNodes) {
      try { (node as OscillatorNode).stop?.(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* ignore */ }
    }
    this._activeNodes = [];
    if (this._endTimer !== null) {
      clearTimeout(this._endTimer);
      this._endTimer = null;
    }
  }

  private _scheduleEndOrLoop(songOffset: number): void {
    const remaining = (this._duration - songOffset) / this._speed;
    if (remaining <= 0) return;

    this._endTimer = setTimeout(() => {
      this._endTimer = null;
      if (!this._playing) return;
      if (this._loop) {
        this._playStartSongTime = 0;
        this._playStartCtxTime = this._ctx().currentTime;
        this._scheduleNotes(0);
        this._scheduleEndOrLoop(0);
      } else {
        this._playing = false;
      }
    }, remaining * 1000);
  }

  async play(): Promise<void> {
    const ctx = this._ctx();
    if (ctx.state === "suspended") await ctx.resume();

    const songOffset = this._playStartSongTime; // preserved from last pause/seek
    this._playStartCtxTime = ctx.currentTime;
    this._playing = true;

    this._scheduleNotes(songOffset);
    this._scheduleEndOrLoop(songOffset);
  }

  pause(): void {
    if (!this._playing) return;
    this._playStartSongTime = this.getCurrentTime();
    this._playing = false;
    this._clearNodes();
  }

  stop(): void {
    this._stop();
  }

  private _stop(): void {
    this._playing = false;
    this._playStartSongTime = 0;
    this._playStartCtxTime = 0;
    this._clearNodes();
  }

  getCurrentTime(): number {
    if (!this._playing || !this.ctx) return this._playStartSongTime;
    const elapsed = (this.ctx.currentTime - this._playStartCtxTime) * this._speed;
    return Math.min(this._playStartSongTime + elapsed, this._duration);
  }

  get duration(): number {
    return this._duration;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  get isPlaying(): boolean {
    return this._playing;
  }

  seek(songSeconds: number): void {
    const wasPlaying = this._playing;
    this._clearNodes();
    this._playStartSongTime = Math.max(0, Math.min(songSeconds, this._duration));
    if (wasPlaying) {
      this._playStartCtxTime = this.ctx?.currentTime ?? 0;
      this._scheduleNotes(this._playStartSongTime);
      this._scheduleEndOrLoop(this._playStartSongTime);
    }
  }

  setSpeed(newSpeed: number): void {
    const wasPlaying = this._playing;
    const songNow = this.getCurrentTime();
    this._clearNodes();
    this._speed = newSpeed;
    this._playStartSongTime = songNow;
    if (wasPlaying && this.ctx) {
      this._playStartCtxTime = this.ctx.currentTime;
      this._scheduleNotes(songNow);
      this._scheduleEndOrLoop(songNow);
    }
  }

  setLoop(loop: boolean): void {
    this._loop = loop;
  }

  dispose(): void {
    this._stop();
    this._loaded = false;
    this.notes = [];
    this._duration = 0;
  }
}
