import { Midi } from "@tonejs/midi";
import type { MidiMetadata } from "@/types";

export function parseMidi(buffer: Buffer): MidiMetadata {
  const midi = new Midi(buffer);

  const note_count = midi.tracks.reduce((sum, t) => sum + t.notes.length, 0);
  const instrument_names = midi.tracks
    .map((t) => t.instrument?.name)
    .filter((n): n is string => Boolean(n) && n !== "acoustic grand piano");

  const tempo_bpm = midi.header.tempos[0]?.bpm ?? 120;
  const duration_sec = midi.duration;

  // @tonejs/midi exposes format and ppq but they are not in the public type declarations
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
