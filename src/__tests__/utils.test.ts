import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDuration, formatDate, getTimeGreeting, cardColor, stripExtension } from "@/lib/utils";

// ─── formatDuration ─────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats 0 seconds", () => expect(formatDuration(0)).toBe("0:00"));
  it("formats sub-minute (< 10s pads)", () => expect(formatDuration(5)).toBe("0:05"));
  it("formats sub-minute (≥ 10s)", () => expect(formatDuration(45)).toBe("0:45"));
  it("formats exactly one minute", () => expect(formatDuration(60)).toBe("1:00"));
  it("formats 1:30", () => expect(formatDuration(90)).toBe("1:30"));
  it("pads single-digit seconds after the minute", () => expect(formatDuration(65)).toBe("1:05"));
  it("truncates fractional seconds", () => expect(formatDuration(90.9)).toBe("1:30"));
  it("handles long durations", () => expect(formatDuration(7325)).toBe("122:05"));
});

// ─── formatDate ─────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns 'Never' for null", () => expect(formatDate(null)).toBe("Never"));
  it("includes month, day, and year for a valid ISO string", () => {
    // Use noon UTC so the local date stays Jun 15 in any timezone (UTC-11 to UTC+11)
    const result = formatDate("2024-06-15T12:00:00.000Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });
  it("formats a different date correctly", () => {
    const result = formatDate("2023-01-01T12:00:00.000Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2023/);
  });
});

// ─── getTimeGreeting ─────────────────────────────────────────────────────────

describe("getTimeGreeting", () => {
  afterEach(() => vi.useRealTimers());

  const setHour = (h: number) => {
    const d = new Date(2024, 0, 1, h, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(d);
  };

  it("returns 'Good morning!' at 5 am", () => { setHour(5); expect(getTimeGreeting()).toBe("Good morning!"); });
  it("returns 'Good morning!' at 11 am", () => { setHour(11); expect(getTimeGreeting()).toBe("Good morning!"); });
  it("returns 'Good afternoon!' at noon", () => { setHour(12); expect(getTimeGreeting()).toBe("Good afternoon!"); });
  it("returns 'Good afternoon!' at 5 pm", () => { setHour(17); expect(getTimeGreeting()).toBe("Good afternoon!"); });
  it("returns 'Good evening!' at 6 pm", () => { setHour(18); expect(getTimeGreeting()).toBe("Good evening!"); });
  it("returns 'Good evening!' at midnight", () => { setHour(0); expect(getTimeGreeting()).toBe("Good evening!"); });
  it("returns 'Good evening!' at 4 am", () => { setHour(4); expect(getTimeGreeting()).toBe("Good evening!"); });
});

// ─── cardColor ───────────────────────────────────────────────────────────────

describe("cardColor", () => {
  it("returns correct color for Energetic", () => expect(cardColor("Energetic")).toBe("#F97316"));
  it("returns correct color for Melancholic", () => expect(cardColor("Melancholic")).toBe("#818CF8"));
  it("returns correct color for Peaceful", () => expect(cardColor("Peaceful")).toBe("#34D399"));
  it("returns correct color for Intense", () => expect(cardColor("Intense")).toBe("#EF4444"));
  it("returns correct color for Playful", () => expect(cardColor("Playful")).toBe("#FBBF24"));
  it("returns correct color for Romantic", () => expect(cardColor("Romantic")).toBe("#F472B6"));
  it("returns correct color for Mysterious", () => expect(cardColor("Mysterious")).toBe("#A78BFA"));
  it("returns correct color for Triumphant", () => expect(cardColor("Triumphant")).toBe("#2DD4BF"));
  it("returns slate fallback for empty string", () => expect(cardColor("")).toBe("#94A3B8"));
  it("returns slate fallback for unknown mood", () => expect(cardColor("Sad")).toBe("#94A3B8"));
});

// ─── stripExtension ──────────────────────────────────────────────────────────

describe("stripExtension", () => {
  it("strips .mid", () => expect(stripExtension("song.mid")).toBe("song"));
  it("strips .midi", () => expect(stripExtension("song.midi")).toBe("song"));
  it("is case-insensitive for .MID", () => expect(stripExtension("song.MID")).toBe("song"));
  it("is case-insensitive for .MIDI", () => expect(stripExtension("song.MIDI")).toBe("song"));
  it("leaves non-midi extensions intact", () => expect(stripExtension("track.mp3")).toBe("track.mp3"));
  it("handles names with no extension", () => expect(stripExtension("song")).toBe("song"));
  it("only strips trailing extension, not mid in the middle", () => {
    expect(stripExtension("midi-file.mid")).toBe("midi-file");
  });
});
