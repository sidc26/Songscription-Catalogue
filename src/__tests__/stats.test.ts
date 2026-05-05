// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { computeStats, buildProfilePrompt } from "@/lib/stats";
import type { Song } from "@/types";

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 1, filename: "a.mid", original_name: "A.mid", title: "A",
    artist: "Bach", instrument: "Piano", genre: "Classical", mood: "Peaceful",
    folder: "Collection", difficulty: "Intermediate",
    duration_sec: 120, tempo_bpm: 96, track_count: 1, note_count: 300,
    format: 1, ticks_per_qn: 480, instrument_names: [],
    key_signature: "C Major", time_signature: "4/4",
    transcription_type: "direct", tags: ["baroque"],
    is_favorite: false, play_count: 0, last_played: null,
    share_count: 0, ai_summary: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeStats — empty library", () => {
  it("returns all-zero stats for empty songs array", () => {
    const s = computeStats([]);
    expect(s.totalSongs).toBe(0);
    expect(s.totalDurationSec).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.favoriteGenre).toBeNull();
    expect(s.tagFillRate).toBe(0);
  });
});

describe("computeStats — totals", () => {
  const songs = [
    makeSong({ id: 1, duration_sec: 60, note_count: 100, tempo_bpm: 80 }),
    makeSong({ id: 2, duration_sec: 120, note_count: 200, tempo_bpm: 120 }),
    makeSong({ id: 3, duration_sec: 180, note_count: 300, tempo_bpm: 160 }),
  ];

  it("sums duration correctly", () => expect(computeStats(songs).totalDurationSec).toBe(360));
  it("sums notes correctly", () => expect(computeStats(songs).totalNotes).toBe(600));
  it("rounds average tempo", () => expect(computeStats(songs).avgTempo).toBe(120));
  it("reports correct total songs", () => expect(computeStats(songs).totalSongs).toBe(3));
  it("timeSavedSec is 5× totalDurationSec", () => {
    const s = computeStats(songs);
    expect(s.timeSavedSec).toBe(s.totalDurationSec * 5);
  });
});

describe("computeStats — favoriteGenre + favoriteMood", () => {
  const songs = [
    makeSong({ id: 1, genre: "Jazz", mood: "Energetic" }),
    makeSong({ id: 2, genre: "Jazz", mood: "Peaceful" }),
    makeSong({ id: 3, genre: "Classical", mood: "Energetic" }),
  ];
  const s = computeStats(songs);

  it("picks the most common genre", () => expect(s.favoriteGenre).toBe("Jazz"));
  it("picks the most common mood", () => expect(s.favoriteMood).toBe("Energetic"));
  it("reports unique genres count", () => expect(s.uniqueGenres).toHaveLength(2));
  it("reports unique moods count", () => expect(s.uniqueMoods).toHaveLength(2));
});

describe("computeStats — tagFillRate", () => {
  it("is 1 when all songs have tags", () => {
    const songs = [makeSong({ tags: ["a"] }), makeSong({ tags: ["b"] })];
    expect(computeStats(songs).tagFillRate).toBe(1);
  });
  it("is 0.5 when half have tags", () => {
    const songs = [makeSong({ id: 1, tags: ["a"] }), makeSong({ id: 2, tags: [] })];
    expect(computeStats(songs).tagFillRate).toBe(0.5);
  });
  it("is 0 when no songs have tags", () => {
    const songs = [makeSong({ tags: [] }), makeSong({ tags: [] })];
    expect(computeStats(songs).tagFillRate).toBe(0);
  });
});

describe("computeStats — favorites", () => {
  it("counts favorited songs correctly", () => {
    const songs = [
      makeSong({ id: 1, is_favorite: true }),
      makeSong({ id: 2, is_favorite: false }),
      makeSong({ id: 3, is_favorite: true }),
    ];
    expect(computeStats(songs).totalFavorites).toBe(2);
  });
});

describe("computeStats — streak", () => {
  afterEach(() => vi.useRealTimers());

  it("counts a streak of 1 when only today has a transcription", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    const songs = [makeSong({ created_at: "2024-06-15T09:00:00Z" })];
    expect(computeStats(songs).currentStreak).toBe(1);
  });

  it("counts a multi-day streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    const songs = [
      makeSong({ id: 1, created_at: "2024-06-15T09:00:00Z" }),
      makeSong({ id: 2, created_at: "2024-06-14T09:00:00Z" }),
      makeSong({ id: 3, created_at: "2024-06-13T09:00:00Z" }),
    ];
    expect(computeStats(songs).currentStreak).toBe(3);
  });

  it("breaks streak when a day is missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    const songs = [
      makeSong({ id: 1, created_at: "2024-06-15T09:00:00Z" }),
      // gap: June 14 missing
      makeSong({ id: 2, created_at: "2024-06-13T09:00:00Z" }),
    ];
    expect(computeStats(songs).currentStreak).toBe(1);
  });

  it("streak is 0 when last transcription was 2+ days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    const songs = [makeSong({ created_at: "2024-06-12T09:00:00Z" })];
    expect(computeStats(songs).currentStreak).toBe(0);
  });

  it("calculates longest streak correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-20T12:00:00Z"));
    const songs = [
      makeSong({ id: 1, created_at: "2024-06-01T09:00:00Z" }),
      makeSong({ id: 2, created_at: "2024-06-02T09:00:00Z" }),
      makeSong({ id: 3, created_at: "2024-06-03T09:00:00Z" }),
      // gap
      makeSong({ id: 4, created_at: "2024-06-10T09:00:00Z" }),
      makeSong({ id: 5, created_at: "2024-06-11T09:00:00Z" }),
    ];
    expect(computeStats(songs).longestStreak).toBe(3);
  });
});

describe("computeStats — difficultyBreakdown", () => {
  it("groups difficulties correctly", () => {
    const songs = [
      makeSong({ id: 1, difficulty: "Beginner" }),
      makeSong({ id: 2, difficulty: "Advanced" }),
      makeSong({ id: 3, difficulty: "Advanced" }),
    ];
    const { difficultyBreakdown } = computeStats(songs);
    expect(difficultyBreakdown["Beginner"]).toBe(1);
    expect(difficultyBreakdown["Advanced"]).toBe(2);
    expect(difficultyBreakdown["Intermediate"]).toBeUndefined();
  });
});

describe("buildProfilePrompt", () => {
  it("includes key stats in the prompt", () => {
    const s = computeStats([
      makeSong({ genre: "Jazz", mood: "Energetic", tempo_bpm: 180 }),
    ]);
    const prompt = buildProfilePrompt(s);
    expect(prompt).toContain("Jazz");
    expect(prompt).toContain("Energetic");
    expect(prompt).toMatch(/180.*BPM/);
  });

  it("returns a non-empty string", () => {
    const prompt = buildProfilePrompt(computeStats([]));
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(50);
  });
});
