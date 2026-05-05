export interface Song {
  id: number;
  filename: string;
  original_name: string;
  title: string;
  artist: string;
  instrument: string;
  genre: string;
  mood: string;
  folder: string;
  difficulty: string;
  duration_sec: number;
  tempo_bpm: number;
  track_count: number;
  note_count: number;
  format: number;
  ticks_per_qn: number;
  instrument_names: string[];
  key_signature: string;
  time_signature: string;
  transcription_type: "direct" | "arrangement";
  tags: string[];
  is_favorite: boolean;
  play_count: number;
  last_played: string | null;
  share_count: number;
  ai_summary: AISummary | null;
  created_at: string;
}

export interface AISummary {
  facts: string[];
  tips: string[];
  related: { title: string; artist: string; reason: string }[];
}

export interface MidiMetadata {
  duration_sec: number;
  tempo_bpm: number;
  track_count: number;
  note_count: number;
  format: number;
  ticks_per_qn: number;
  instrument_names: string[];
}

export interface WizardData {
  filename: string;
  original_name: string;
  midi: MidiMetadata;
  title: string;
  artist: string;
  instrument: string;
  genre: string;
  mood: string;
  difficulty: string;
  folder: string;
  tags: string;
  key_signature: string;
  time_signature: string;
  transcription_type: "direct" | "arrangement";
  target_instrument?: string;
}
