"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, BookOpen, Lightbulb, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Song, AISummary as AISummaryType } from "@/types";

interface Props {
  song: Song;
  onSummaryGenerated: (summary: AISummaryType) => void;
}

export function AISummary({ song, onSummaryGenerated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/songs/${song.id}/ai-summary`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate summary");
      }
      const data = await res.json();
      onSummaryGenerated(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const summary = song.ai_summary;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-card-hover border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <span className="text-sm font-semibold text-text">AI Music Teacher</span>
          <Badge variant="muted" className="text-[10px]">Groq</Badge>
        </div>
        {summary && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Regenerate
          </button>
        )}
      </div>

      <div className="p-4">
        {loading && !summary && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</div>
        )}

        {!summary && !loading && !error && (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-3">
              Get practice tips, fun facts, and related songs to study alongside this piece.
            </p>
            <button
              onClick={generate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              <Sparkles size={14} />
              Generate insights
            </button>
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            {/* Facts */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={13} className="text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">About this piece</span>
              </div>
              <ul className="space-y-1.5">
                {summary.facts.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text">
                    <span className="text-accent mt-0.5 shrink-0">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tips */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={13} className="text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Practice tips</span>
              </div>
              <ul className="space-y-1.5">
                {summary.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text">
                    <span className="text-accent mt-0.5 shrink-0">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Related */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Music size={13} className="text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Study alongside</span>
              </div>
              <div className="space-y-2">
                {summary.related.map((r, i) => (
                  <div key={i} className="rounded-lg bg-accent-muted px-3 py-2">
                    <p className="text-sm font-medium text-text">
                      {r.title} <span className="font-normal text-muted">— {r.artist}</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5 italic">{r.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
