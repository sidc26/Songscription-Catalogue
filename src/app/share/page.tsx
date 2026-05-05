"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Music2, Flame, Clock, BookOpen, Zap, BarChart3, Star, TrendingUp } from "lucide-react";
import { SongscriptionLogo } from "@/components/SongscriptionLogo";
import { cardColor, formatDate } from "@/lib/utils";
import type { ProfileStats } from "@/lib/stats";

interface ShareData {
  stats: ProfileStats;
  summary: string | null;
  generated_at: string;
}

function fmtDuration(sec: number, prefix = ""): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${prefix}${h}h ${m}m ${s}s`;
  if (m > 0) return `${prefix}${m}m ${s}s`;
  return `${prefix}${s}s`;
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="text-white/50">{icon}</div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-white/50 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function ShareContent() {
  const params = useSearchParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = params.get("d");
    if (!raw) { setError(true); return; }
    try {
      const decoded = decodeURIComponent(escape(atob(raw)));
      setData(JSON.parse(decoded));
    } catch {
      setError(true);
    }
  }, [params]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <p className="text-white/60 mb-4">This share link is invalid or expired.</p>
          <a href="/" className="text-sm text-[#2A9B8A] underline">Open Songscription</a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="w-8 h-8 border-2 border-[#2A9B8A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { stats, summary } = data;
  const savedLabel = fmtDuration(stats.timeSavedSec, "~");
  const days = stats.currentStreak;
  const streakColor = days === 0 ? "#94A3B8" : days < 2 ? "#FEF08A" : days < 4 ? "#FCD34D" : days < 7 ? "#FB923C" : days < 14 ? "#EF4444" : days < 30 ? "#DC2626" : "#991B1B";

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <SongscriptionLogo iconSize={20} />
          <span className="text-xs text-white/30">Songscripter Profile</span>
        </div>

        {/* AI Identity card */}
        {summary && (
          <div className="relative rounded-2xl overflow-hidden border border-[#2A9B8A]/30 p-5"
            style={{ background: "linear-gradient(135deg, rgba(42,155,138,0.12) 0%, rgba(42,155,138,0.04) 100%)" }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2A9B8A] via-[#2A9B8A]/50 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <Music2 size={13} className="text-[#2A9B8A]" />
              <span className="text-[10px] font-semibold text-[#2A9B8A] uppercase tracking-wider">Transcriber Identity</span>
            </div>
            <p className="text-sm text-white/85 leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Streak */}
        {stats.currentStreak > 0 && (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/5">
            <Flame size={20} fill={streakColor} style={{ color: streakColor }} />
            <span className="text-2xl font-bold text-white">{stats.currentStreak}</span>
            <span className="text-sm text-white/50">day streak</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatPill icon={<BookOpen size={15} />} label="Transcriptions" value={String(stats.totalSongs)} />
          <StatPill icon={<Clock size={15} />} label="Total duration" value={fmtDuration(stats.totalDurationSec)} />
          <StatPill icon={<Zap size={15} />} label="Time saved" value={savedLabel} />
          <StatPill icon={<TrendingUp size={15} />} label="Avg tempo" value={`${stats.avgTempo} BPM`} />
        </div>

        {/* Genre + mood */}
        {(stats.favoriteGenre || stats.favoriteMood) && (
          <div className="grid grid-cols-2 gap-3">
            {stats.favoriteGenre && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Top genre</p>
                <p className="text-base font-bold text-white">{stats.favoriteGenre}</p>
              </div>
            )}
            {stats.favoriteMood && (
              <div className="p-4 rounded-xl border border-white/10" style={{ backgroundColor: `${cardColor(stats.favoriteMood)}18` }}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Top mood</p>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cardColor(stats.favoriteMood) }} />
                  <p className="text-base font-bold text-white">{stats.favoriteMood}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Favourites + notes */}
        <div className="grid grid-cols-2 gap-3">
          <StatPill icon={<Star size={15} />} label="Favorites" value={`${stats.totalFavorites} / ${stats.totalSongs}`} />
          <StatPill icon={<BarChart3 size={15} />} label="Total notes" value={stats.totalNotes > 0 ? stats.totalNotes.toLocaleString() : "—"} />
        </div>

        {/* Footer CTA */}
        <div className="text-center pt-2">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#2A9B8A" }}
          >
            <Music2 size={14} />
            Build your own Songscription profile
          </a>
          {data.generated_at && (
            <p className="text-[10px] text-white/25 mt-3">Generated {formatDate(data.generated_at)}</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="w-8 h-8 border-2 border-[#2A9B8A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
