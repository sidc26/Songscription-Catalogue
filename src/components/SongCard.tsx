"use client";
import { useState, useRef, useEffect } from "react";
import { Heart, Clock, Music2, Trash2 } from "lucide-react";
import { cardColor, formatDuration } from "@/lib/utils";
import type { Song } from "@/types";

interface Props {
  song: Song;
  view: "grid" | "list";
  onFavorite: (id: number, val: boolean) => void;
  onClick: (song: Song) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDelete?: (id: number) => void;
}

export function SongCard({ song, view, onFavorite, onClick, onDragStart, onDelete }: Props) {
  const color = cardColor(song.mood);
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite(song.id, !song.is_favorite);
  };

  const handleTrashClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (confirming) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      onDelete(song.id);
      setConfirming(false);
    } else {
      setConfirming(true);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  if (view === "list") {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, song.id)}
        onClick={() => onClick(song)}
        className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:bg-card-hover hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text truncate">{song.title}</p>
          <p className="text-xs text-muted truncate">{song.artist || "Unknown artist"}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs text-muted shrink-0">
          {song.key_signature && <span className="px-1.5 py-0.5 rounded bg-accent-muted text-accent font-medium">{song.key_signature}</span>}
          {song.genre && <span>{song.genre}</span>}
          <span className="flex items-center gap-1"><Clock size={11} />{formatDuration(song.duration_sec)}</span>
          <span className="flex items-center gap-1"><Music2 size={11} />{Math.round(song.tempo_bpm)} bpm</span>
          <span className="w-16 text-right">{song.folder}</span>
        </div>
        <button
          onClick={handleFavorite}
          className={`ml-2 shrink-0 transition-colors ${song.is_favorite ? "text-accent" : "text-border group-hover:text-muted"}`}
        >
          <Heart size={15} fill={song.is_favorite ? "currentColor" : "none"} />
        </button>
        {onDelete && (
          <div className="flex items-center gap-1.5 ml-1 shrink-0">
            {confirming && (
              <span className="text-[10px] text-red-500 font-medium">click again</span>
            )}
            <button
              onClick={handleTrashClick}
              title={confirming ? "Click again to delete" : "Delete"}
              className={`transition-all ${
                confirming
                  ? "text-red-500"
                  : "opacity-0 group-hover:opacity-100 text-muted hover:text-red-500"
              }`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, song.id)}
      onClick={() => onClick(song)}
      className="relative bg-card border border-border rounded-xl overflow-hidden hover:bg-card-hover hover:shadow-md transition-all cursor-grab active:cursor-grabbing active:opacity-60 group"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Color strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="p-4">
        {/* Top-right: heart + trash */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          {onDelete && (
            <button
              onClick={handleTrashClick}
              title={confirming ? "Click again to delete" : "Delete"}
              className={`transition-all rounded p-0.5 ${
                confirming
                  ? "text-red-500 bg-red-50"
                  : "opacity-0 group-hover:opacity-100 text-muted hover:text-red-500"
              }`}
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={handleFavorite}
            className={`transition-colors ${song.is_favorite ? "text-accent" : "text-border group-hover:text-muted"}`}
          >
            <Heart size={15} fill={song.is_favorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3 pr-12">
          <p className="text-sm font-semibold text-text truncate leading-none">{song.title}</p>
          <p className="text-xs text-muted truncate leading-none">{song.artist || "Unknown artist"}</p>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-card-hover text-muted">{formatDuration(song.duration_sec)}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-card-hover text-muted">♩ {Math.round(song.tempo_bpm)}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-card-hover text-muted">{song.track_count}tr</span>
        </div>

        {(song.key_signature || song.time_signature) && (
          <div className="flex gap-1 mb-2">
            {song.key_signature && (
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-accent text-accent font-medium">{song.key_signature}</span>
            )}
            {song.time_signature && (
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-accent text-accent font-medium">{song.time_signature}</span>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted truncate">{song.folder}</p>

        {/* Confirming overlay hint */}
        {confirming && (
          <div className="absolute inset-0 bg-red-500/5 rounded-xl border border-red-200 pointer-events-none flex items-end justify-center pb-2">
            <span className="text-[10px] text-red-500 font-medium">Click trash again to delete</span>
          </div>
        )}
      </div>
    </div>
  );
}
