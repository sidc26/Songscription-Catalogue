"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X, RefreshCw, Share2, Flame, Clock, Music2, Star, Tag,
  BarChart3, Calendar, Zap, TrendingUp, Check, BookOpen,
} from "lucide-react";
import { computeStats } from "@/lib/stats";
import { formatDuration, formatDate, cardColor } from "@/lib/utils";
import type { Song } from "@/types";
import type { ProfileStats } from "@/lib/stats";

// ─── Jokes ───────────────────────────────────────────────────────────────────

const JOKES_EMPTY = [
  "Your library is emptier than a concert hall on a Tuesday.",
  "No transcriptions yet. The page is blank. Like your future in music theory (kidding).",
];

const JOKES_FEW = [
  "Three transcriptions walk into a bar. The bartender says, 'Is that all you got?'",
  "Your catalogue could fit on a Post-it note. A small one.",
  "Bold choice, calling this a library. Libraries usually have more than a shelf.",
];

const JOKES_NO_TAGS = [
  "Tags: zero. You're living dangerously.",
  "Tagging system: vibes only. Respect, kind of.",
  "Future you will search for that one piece and find nothing. Future you is already annoyed.",
];

const JOKES_NO_FAVORITES = [
  "Not a single favorite. Either you love them all equally, or nothing at all.",
  "Zero favorites. Classic commitment issues.",
  "You've transcribed pieces but haven't hearted one. Emotionally unavailable energy.",
];

function pickJoke(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getJokes(stats: ProfileStats): string[] {
  const jokes: string[] = [];
  if (stats.totalSongs === 0) return [pickJoke(JOKES_EMPTY)];
  if (stats.totalSongs < 4) jokes.push(pickJoke(JOKES_FEW));
  if (stats.tagFillRate < 0.15 && stats.totalSongs > 2) jokes.push(pickJoke(JOKES_NO_TAGS));
  if (stats.totalFavorites === 0 && stats.totalSongs > 3) jokes.push(pickJoke(JOKES_NO_FAVORITES));
  return jokes;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-1.5 text-muted">{icon}<span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span></div>
      <p className="text-xl font-bold text-text leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function flameColor(days: number): string {
  if (days === 0) return "#94A3B8"; // gray — no streak
  if (days < 2)   return "#FEF08A"; // pale yellow — just started
  if (days < 4)   return "#FCD34D"; // golden — warming up
  if (days < 7)   return "#FB923C"; // orange — getting hot
  if (days < 14)  return "#EF4444"; // red — on fire
  if (days < 30)  return "#DC2626"; // deep red — blazing
  return "#991B1B";                 // dark crimson — inferno
}

function StreakBadge({ days, label }: { days: number; label: string }) {
  const color = flameColor(days);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1" style={{ color }}>
        <Flame size={18} fill={days > 0 ? color : "none"} />
        <span className="text-2xl font-bold">{days}</span>
      </div>
      <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

function MoodBar({ mood, count, total }: { mood: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cardColor(mood) }} />
      <span className="text-xs text-text w-24 truncate">{mood}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cardColor(mood) }} />
      </div>
      <span className="text-[10px] text-muted w-5 text-right">{count}</span>
    </div>
  );
}

// ─── Share ────────────────────────────────────────────────────────────────────

interface ShareData {
  stats: ProfileStats;
  summary: string | null;
  generated_at: string;
}

function buildShareUrl(data: ShareData): string {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return `${window.location.origin}/share?d=${encoded}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  songs: Song[];
  onClose: () => void;
}

export function ProfilePanel({ songs, onClose }: Props) {
  const stats = useMemo(() => computeStats(songs), [songs]);
  const jokes = useMemo(() => getJokes(stats), [stats]);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryDate, setSummaryDate] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Load cached summary from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("profile_summary");
      if (cached) {
        const { text, date } = JSON.parse(cached);
        setSummary(text);
        setSummaryDate(date);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (stats.totalSongs === 0) return;
    setLoadingSummary(true);
    setSummaryError(false);
    try {
      const res = await fetch("/api/profile-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });
      if (!res.ok) throw new Error("Failed");
      const { summary: text, generated_at } = await res.json();
      setSummary(text);
      setSummaryDate(generated_at);
      localStorage.setItem("profile_summary", JSON.stringify({ text, date: generated_at }));
    } catch {
      setSummaryError(true);
    } finally {
      setLoadingSummary(false);
    }
  }, [stats]);

  // Auto-fetch if no cached summary and songs exist
  useEffect(() => {
    if (!summary && stats.totalSongs > 0) fetchSummary();
  }, []); // only on mount

  const handleShare = useCallback(async () => {
    setShareLoading(true);
    try {
      const url = buildShareUrl({ stats, summary, generated_at: summaryDate ?? new Date().toISOString() });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setShareLoading(false);
    }
  }, [stats, summary, summaryDate]);

  // Mood breakdown for bar chart
  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of songs) if (s.mood) counts[s.mood] = (counts[s.mood] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  function fmtDur(sec: number, prefix = ""): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${prefix}${h}h ${m}m ${s}s`;
    if (m > 0) return `${prefix}${m}m ${s}s`;
    return `${prefix}${s}s`;
  }
  const durationLabel = stats.totalSongs > 0 ? fmtDur(stats.totalDurationSec) : "—";
  const savedLabel = stats.totalSongs > 0 ? fmtDur(stats.timeSavedSec, "~") : "—";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg shrink-0">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-text">Your Profile</h2>
        </div>
        <div className="flex items-center gap-2">
          {stats.totalSongs > 0 && (
            <>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                {copied ? <Check size={13} className="text-green-500" /> : <Share2 size={13} />}
                {copied ? "Copied!" : "Share"}
              </button>
              <button
                onClick={fetchSummary}
                disabled={loadingSummary}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs text-muted hover:text-text hover:bg-card-hover transition-colors"
                title="Regenerate AI description"
              >
                <RefreshCw size={13} className={loadingSummary ? "animate-spin" : ""} />
                Regenerate
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

          {/* AI Identity Card */}
          {stats.totalSongs > 0 && (
            <div className="relative rounded-2xl overflow-hidden border border-accent/20" style={{ background: "linear-gradient(135deg, rgba(42,155,138,0.08) 0%, rgba(42,155,138,0.03) 100%)" }}>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent via-accent/60 to-transparent" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
                      <Music2 size={14} className="text-accent" />
                    </div>
                    <span className="text-xs font-semibold text-accent uppercase tracking-wider">Your Songscripter Identity</span>
                  </div>
                  {summaryDate && (
                    <span className="text-[10px] text-muted shrink-0">{formatDate(summaryDate)}</span>
                  )}
                </div>

                {loadingSummary ? (
                  <div className="space-y-2">
                    {[85, 70, 50].map((w, i) => (
                      <div key={i} className="h-3.5 bg-border rounded animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : summaryError ? (
                  <p className="text-sm text-muted italic">Could not generate description. Check your GROQ_API_KEY.</p>
                ) : summary ? (
                  <p className="text-sm text-text leading-relaxed">{summary}</p>
                ) : (
                  <p className="text-sm text-muted italic">Generating your transcriber identity…</p>
                )}
              </div>
            </div>
          )}

          {/* Jokes (when sparse) + encouragement */}
          {jokes.length > 0 && (
            <div className="space-y-2">
              {jokes.map((joke, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-card border border-border">
                  <span className="text-base shrink-0">🥁</span>
                  <p className="text-sm text-muted italic">{joke}</p>
                </div>
              ))}
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-accent/30 bg-accent/5">
                <span className="text-base shrink-0">🎵</span>
                <p className="text-sm font-medium text-accent">Keep transcribing — every piece makes the library richer!</p>
              </div>
            </div>
          )}

          {/* Streak */}
          <div className="flex items-center justify-around p-5 bg-card border border-border rounded-xl">
            <StreakBadge days={stats.currentStreak} label="Current streak" />
            <div className="w-px h-10 bg-border" />
            <StreakBadge days={stats.longestStreak} label="Longest streak" />
            <div className="w-px h-10 bg-border" />
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1 text-text">
                <Calendar size={16} className="text-muted" />
                <span className="text-sm font-semibold">
                  {stats.lastTranscribed ? formatDate(stats.lastTranscribed) : "—"}
                </span>
              </div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Last transcription</span>
            </div>
          </div>

          {/* Core stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatTile
              icon={<BookOpen size={13} />}
              label="Transcriptions"
              value={String(stats.totalSongs)}
              sub={stats.totalSongs === 1 ? "piece" : "pieces"}
            />
            <StatTile
              icon={<Clock size={13} />}
              label="Total duration"
              value={stats.totalSongs > 0 ? durationLabel : "—"}
              sub="of music transcribed"
            />
            <StatTile
              icon={<Zap size={13} />}
              label="Time saved"
              value={stats.totalSongs > 0 ? savedLabel : "—"}
              sub="vs. manual transcription"
            />
            <StatTile
              icon={<Music2 size={13} />}
              label="Total notes"
              value={stats.totalNotes > 0 ? stats.totalNotes.toLocaleString() : "—"}
            />
            <StatTile
              icon={<TrendingUp size={13} />}
              label="Avg tempo"
              value={stats.totalSongs > 0 ? `${stats.avgTempo} BPM` : "—"}
              sub={stats.avgTempo >= 140 ? "fast" : stats.avgTempo >= 90 ? "moderate" : "slow"}
            />
            <StatTile
              icon={<Star size={13} />}
              label="Favorites"
              value={`${stats.totalFavorites} / ${stats.totalSongs}`}
              sub={stats.totalSongs > 0 ? `${Math.round((stats.totalFavorites / stats.totalSongs) * 100)}% hearted` : undefined}
            />
          </div>

          {/* Genre + Mood breakdown */}
          {(stats.favoriteGenre || stats.favoriteMood) && (
            <div className="grid grid-cols-2 gap-3">
              {stats.favoriteGenre && (
                <div className="p-4 bg-card border border-border rounded-xl">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-1">Top genre</p>
                  <p className="text-lg font-bold text-text">{stats.favoriteGenre}</p>
                  <p className="text-[11px] text-muted">{stats.uniqueGenres.length} genre{stats.uniqueGenres.length !== 1 ? "s" : ""} explored</p>
                </div>
              )}
              {stats.favoriteMood && (
                <div className="p-4 border border-border rounded-xl" style={{ backgroundColor: `${cardColor(stats.favoriteMood)}15` }}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-1">Top mood</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cardColor(stats.favoriteMood) }} />
                    <p className="text-lg font-bold text-text">{stats.favoriteMood}</p>
                  </div>
                  <p className="text-[11px] text-muted">{stats.uniqueMoods.length} mood{stats.uniqueMoods.length !== 1 ? "s" : ""} in your library</p>
                </div>
              )}
            </div>
          )}

          {/* Mood distribution */}
          {moodCounts.length > 1 && (
            <div className="p-4 bg-card border border-border rounded-xl">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-3">Mood distribution</p>
              <div className="space-y-2">
                {moodCounts.map(([mood, count]) => (
                  <MoodBar key={mood} mood={mood} count={count} total={stats.totalSongs} />
                ))}
              </div>
            </div>
          )}

          {/* Tags + transcription type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-1.5 text-muted mb-3">
                <Tag size={13} />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Tag coverage</span>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-2xl font-bold text-text">{Math.round(stats.tagFillRate * 100)}%</p>
                <p className="text-[11px] text-muted">of pieces tagged</p>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(stats.tagFillRate * 100)}%`,
                    backgroundColor: stats.tagFillRate > 0.6 ? "#34D399" : stats.tagFillRate > 0.3 ? "#FBBF24" : "#EF4444",
                  }}
                />
              </div>
            </div>

            <div className="p-4 bg-card border border-border rounded-xl">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-3">Transcription type</p>
              <div className="space-y-2.5">
                {[
                  { label: "Direct", count: stats.transcriptionTypeBreakdown.direct, color: "#2A9B8A" },
                  { label: "Arr.", count: stats.transcriptionTypeBreakdown.arrangement, color: "#8B5CF6" },
                ].map(({ label, count, color }) => {
                  const pct = stats.totalSongs > 0 ? (count / stats.totalSongs) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-text font-medium">{label}</span>
                        <span className="text-muted tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Difficulty breakdown */}
          {Object.keys(stats.difficultyBreakdown).length > 0 && (
            <div className="p-4 bg-card border border-border rounded-xl">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-3">Difficulty range</p>
              <div className="space-y-2.5">
                {(["Beginner", "Intermediate", "Advanced", "Expert"] as const).map((d) => {
                  const count = stats.difficultyBreakdown[d] ?? 0;
                  const pct = stats.totalSongs > 0 ? (count / stats.totalSongs) * 100 : 0;
                  const colors = { Beginner: "#34D399", Intermediate: "#FBBF24", Advanced: "#F97316", Expert: "#EF4444" };
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[d] }} />
                      <span className="text-xs text-text w-24 shrink-0">{d}</span>
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[d] }} />
                      </div>
                      <span className="text-[10px] font-semibold text-text w-4 text-right tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {stats.totalSongs === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <BarChart3 size={40} className="text-muted" />
              <p className="text-base font-semibold text-text">No data yet</p>
              <p className="text-sm text-muted max-w-xs">Upload your first transcription to start building your profile.</p>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
