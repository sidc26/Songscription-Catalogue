// @tonejs/midi is used only for parsing on the server side (Node.js).
// The playback runtime (tone-player.ts) also imports it client-side but uses the
// Web Audio API for sound synthesis — the Tone.js transport is never instantiated.
import { Midi } from "@tonejs/midi";
import type { MidiMetadata } from "@/types";

export function parseMidi(buffer: Buffer): MidiMetadata {
  const midi = new Midi(buffer);

  const note_count = midi.tracks.reduce((sum, t) => sum + t.notes.length, 0);
  // "acoustic grand piano" is the GM default and is almost always meaningless
  // metadata noise — filtering it keeps instrument_names useful.
  const instrument_names = midi.tracks
    .map((t) => t.instrument?.name)
    .filter((n): n is string => Boolean(n) && n !== "acoustic grand piano");

  // Only the first tempo event is stored. Files with multiple tempo changes (e.g.
  // rubato classical pieces) will show only the opening tempo, which is the most
  // recognisable value for display and search purposes.
  const tempo_bpm = midi.header.tempos[0]?.bpm ?? 120;
  const duration_sec = midi.duration;

  // format and ppq exist at runtime but are absent from @tonejs/midi's published type
  // declarations, so we escape the type system here rather than patch the package.
  const header = midi.header as unknown as { format: number; ppq: number };

  return {
    duration_sec,
    tempo_bpm: Math.round(tempo_bpm * 10) / 10,
    track_count: midi.tracks.length,
    note_count,
    format: header.format ?? 1,
    ticks_per_qn: header.ppq ?? 480,
    instrument_names,
  };
}
