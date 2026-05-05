import type { Song } from "@/types";

export interface ProfileStats {
  totalSongs: number;
  totalDurationSec: number;
  totalNotes: number;
  totalFavorites: number;
  favoriteGenre: string | null;
  favoriteMood: string | null;
  avgTempo: number;
  currentStreak: number;
  longestStreak: number;
  timeSavedSec: number;
  lastTranscribed: string | null;
  tagFillRate: number;       // 0–1
  uniqueGenres: string[];
  uniqueMoods: string[];
  topFolder: string | null;
  difficultyBreakdown: Record<string, number>;
  transcriptionTypeBreakdown: { direct: number; arrangement: number };
}

function mostCommon(arr: string[]): string | null {
  const counts = new Map<string, number>();
  for (const s of arr) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best: [string, number] | null = null;
  for (const [k, v] of counts) if (!best || v > best[1]) best = [k, v];
  return best?.[0] ?? null;
}

function toDay(iso: string): string {
  return iso.slice(0, 10);
}

function calcStreaks(songs: Song[]): { current: number; longest: number } {
  if (songs.length === 0) return { current: 0, longest: 0 };

  const daySet = new Set(songs.map((s) => toDay(s.created_at)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Current streak: starts from today if active, else yesterday
  const todayStr = today.toISOString().slice(0, 10);
  const yesterStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  let current = 0;
  if (daySet.has(todayStr) || daySet.has(yesterStr)) {
    const cursor = new Date(daySet.has(todayStr) ? today : today.getTime() - 86400000);
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Longest streak ever
  const sorted = [...daySet].sort();
  let longest = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
    run = diff === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  if (sorted.length > 0) longest = Math.max(longest, 1);

  return { current, longest };
}

export function computeStats(songs: Song[]): ProfileStats {
  if (songs.length === 0) {
    return {
      totalSongs: 0, totalDurationSec: 0, totalNotes: 0, totalFavorites: 0,
      favoriteGenre: null, favoriteMood: null, avgTempo: 0,
      currentStreak: 0, longestStreak: 0, timeSavedSec: 0,
      lastTranscribed: null, tagFillRate: 0,
      uniqueGenres: [], uniqueMoods: [], topFolder: null,
      difficultyBreakdown: {}, transcriptionTypeBreakdown: { direct: 0, arrangement: 0 },
    };
  }

  const totalDurationSec = songs.reduce((s, x) => s + x.duration_sec, 0);
  const totalNotes = songs.reduce((s, x) => s + x.note_count, 0);
  const totalFavorites = songs.filter((s) => s.is_favorite).length;
  const avgTempo = Math.round(songs.reduce((s, x) => s + x.tempo_bpm, 0) / songs.length);

  const favoriteGenre = mostCommon(songs.map((s) => s.genre).filter(Boolean));
  const favoriteMood = mostCommon(songs.map((s) => s.mood).filter(Boolean));
  const topFolder = mostCommon(
    songs.map((s) => s.folder).filter((f) => f && f !== "Collection")
  );

  const uniqueGenres = [...new Set(songs.map((s) => s.genre).filter(Boolean))];
  const uniqueMoods = [...new Set(songs.map((s) => s.mood).filter(Boolean))];
  const tagFillRate = songs.filter((s) => s.tags.length > 0).length / songs.length;

  const difficultyBreakdown: Record<string, number> = {};
  for (const s of songs) {
    if (s.difficulty) difficultyBreakdown[s.difficulty] = (difficultyBreakdown[s.difficulty] ?? 0) + 1;
  }

  const transcriptionTypeBreakdown = {
    direct: songs.filter((s) => s.transcription_type === "direct").length,
    arrangement: songs.filter((s) => s.transcription_type === "arrangement").length,
  };

  const { current, longest } = calcStreaks(songs);
  const sorted = [...songs].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    totalSongs: songs.length,
    totalDurationSec,
    totalNotes,
    totalFavorites,
    favoriteGenre,
    favoriteMood,
    avgTempo,
    currentStreak: current,
    longestStreak: longest,
    // Estimate: manual transcription ≈ 5× playback time.
    // Future: replace with a smarter per-piece algorithm (difficulty, genre, note density).
    timeSavedSec: Math.round(totalDurationSec * 5),
    lastTranscribed: sorted[0]?.created_at ?? null,
    tagFillRate,
    uniqueGenres,
    uniqueMoods,
    topFolder,
    difficultyBreakdown,
    transcriptionTypeBreakdown,
  };
}

export function buildProfilePrompt(stats: ProfileStats): string {
  const dur = `${Math.floor(stats.totalDurationSec / 60)}m`;
  const genres = stats.uniqueGenres.join(", ") || "none tagged";
  const moods = stats.uniqueMoods.join(", ") || "none tagged";
  const tagsDesc = stats.tagFillRate > 0.7 ? "meticulously tags everything"
    : stats.tagFillRate > 0.3 ? "tags some pieces"
    : "rarely uses tags";

  return `You are writing a 2–3 sentence "transcriber identity" description for a Spotify Wrapped–style profile card.

Here is the transcriber's library data:
- ${stats.totalSongs} total transcriptions (${dur} of music)
- Favorite genre: ${stats.favoriteGenre ?? "not set"}
- Favorite mood: ${stats.favoriteMood ?? "not set"}
- Genres explored: ${genres}
- Moods tagged: ${moods}
- Average tempo: ${stats.avgTempo} BPM
- ${tagsDesc}
- Current streak: ${stats.currentStreak} days
- Longest streak: ${stats.longestStreak} days
- Favorites: ${stats.totalFavorites} of ${stats.totalSongs}

Write a creative, specific, slightly witty description of who this transcriber is — their musical personality, obsessions, and style. Don't just list numbers; paint a picture. Think Spotify Wrapped meets a music critic. Two to three sentences maximum. No intro phrase like "You are...". Just the description.`;
}
