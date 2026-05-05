// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// Stub node:sqlite so db.ts can be imported without a real SQLite connection.
// vi.mock is hoisted before all imports, so this runs before db.ts loads.
// rowToSong is a pure transformation function — it never calls getDb() or DatabaseSync.
vi.mock("node:sqlite", () => ({
  DatabaseSync: class {
    exec() {}
    prepare() {
      return { run: () => ({ lastInsertRowid: 1 }), get: () => null, all: () => [] };
    }
  },
}));

import { rowToSong } from "@/lib/db";

// ─── rowToSong ───────────────────────────────────────────────────────────────

const baseRow: Record<string, unknown> = {
  id: 1,
  filename: "abc.mid",
  original_name: "My Song.mid",
  title: "My Song",
  artist: "Bach",
  instrument: "Piano",
  genre: "Classical",
  mood: "Peaceful",
  folder: "Collection",
  difficulty: "Intermediate",
  duration_sec: 120.5,
  tempo_bpm: 96.0,
  track_count: 2,
  note_count: 450,
  format: 1,
  ticks_per_qn: 480,
  instrument_names: '["Piano","Violin"]',
  key_signature: "C Major",
  time_signature: "4/4",
  transcription_type: "direct",
  tags: '["baroque","solo"]',
  is_favorite: 0,
  play_count: 3,
  last_played: "2024-06-01T10:00:00Z",
  share_count: 1,
  ai_summary: null,
  created_at: "2024-05-01T08:00:00Z",
};

describe("rowToSong — field mapping", () => {
  it("maps scalar fields correctly", () => {
    const song = rowToSong(baseRow);
    expect(song.id).toBe(1);
    expect(song.title).toBe("My Song");
    expect(song.artist).toBe("Bach");
    expect(song.duration_sec).toBe(120.5);
    expect(song.tempo_bpm).toBe(96.0);
    expect(song.track_count).toBe(2);
    expect(song.note_count).toBe(450);
    expect(song.key_signature).toBe("C Major");
    expect(song.time_signature).toBe("4/4");
    expect(song.folder).toBe("Collection");
    expect(song.created_at).toBe("2024-05-01T08:00:00Z");
  });

  it("parses instrument_names JSON array", () => {
    const song = rowToSong(baseRow);
    expect(song.instrument_names).toEqual(["Piano", "Violin"]);
  });

  it("parses tags JSON array", () => {
    const song = rowToSong(baseRow);
    expect(song.tags).toEqual(["baroque", "solo"]);
  });

  it("converts is_favorite integer 0 → false", () => {
    expect(rowToSong(baseRow).is_favorite).toBe(false);
  });

  it("converts is_favorite integer 1 → true", () => {
    expect(rowToSong({ ...baseRow, is_favorite: 1 }).is_favorite).toBe(true);
  });

  it("returns null for ai_summary when DB value is null", () => {
    expect(rowToSong(baseRow).ai_summary).toBeNull();
  });

  it("parses ai_summary JSON when present", () => {
    const summary = {
      facts: ["fact"], tips: ["tip"],
      related: [{ title: "T", artist: "A", reason: "R" }],
    };
    const song = rowToSong({ ...baseRow, ai_summary: JSON.stringify(summary) });
    expect(song.ai_summary?.facts).toEqual(["fact"]);
  });
});

describe("rowToSong — JSON fallbacks", () => {
  it("falls back to [] for malformed instrument_names", () => {
    expect(rowToSong({ ...baseRow, instrument_names: "not-json" }).instrument_names).toEqual([]);
  });

  it("falls back to [] for malformed tags", () => {
    expect(rowToSong({ ...baseRow, tags: "{broken}" }).tags).toEqual([]);
  });

  it("falls back to [] for null instrument_names", () => {
    expect(rowToSong({ ...baseRow, instrument_names: null }).instrument_names).toEqual([]);
  });

  it("falls back to [] for null tags", () => {
    expect(rowToSong({ ...baseRow, tags: null }).tags).toEqual([]);
  });

  it("falls back to null for malformed ai_summary", () => {
    expect(rowToSong({ ...baseRow, ai_summary: "{{bad}}" }).ai_summary).toBeNull();
  });
});

describe("rowToSong — transcription_type", () => {
  it("accepts 'direct'", () => {
    expect(rowToSong({ ...baseRow, transcription_type: "direct" }).transcription_type).toBe("direct");
  });

  it("accepts 'arrangement'", () => {
    expect(rowToSong({ ...baseRow, transcription_type: "arrangement" }).transcription_type).toBe("arrangement");
  });
});
