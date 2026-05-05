"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import type { WizardData } from "@/types";

const MidiPlayer = dynamic(() => import("../MidiPlayer").then((m) => ({ default: m.MidiPlayer })), { ssr: false });

interface Props {
  data: Partial<WizardData>;
  onNext: (data: Pick<WizardData, never>) => void;
  onBack: () => void;
}

export function Step2Trim({ data, onNext, onBack }: Props) {
  const duration = data.midi?.duration_sec ?? 0;
  const filename = data.filename ?? "";

  const [startPct, setStartPct] = useState(0);
  const [endPct, setEndPct] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"start" | "end" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const bars = 120;
    const barW = W / bars;
    ctx.clearRect(0, 0, W, H);
    const seed = filename.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < bars; i++) {
      const h = (Math.sin(i * 0.3 + seed) * 0.4 + Math.sin(i * 0.7 + seed * 2) * 0.3 + 0.5) * H * 0.85 + H * 0.1;
      const x = i * barW;
      const inRange = i / bars >= startPct && i / bars <= endPct;
      ctx.fillStyle = inRange ? "#2A9B8A" : "#D1FAF4";
      ctx.beginPath();
      ctx.roundRect(x + 1, (H - h) / 2, barW - 2, h, 2);
      ctx.fill();
    }
  }, [filename, startPct, endPct]);

  const getPct = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const r = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const applyDrag = useCallback((clientX: number) => {
    if (!dragging.current) return;
    const pct = getPct(clientX);
    if (dragging.current === "start") setStartPct((prev) => Math.min(pct, endPct - 0.05));
    else setEndPct((prev) => Math.max(pct, startPct + 0.05));
  }, [startPct, endPct]);

  // Mouse events
  const handleMouseMove = useCallback((e: MouseEvent) => { applyDrag(e.clientX); }, [applyDrag]);
  const handleMouseUp = useCallback(() => { dragging.current = null; }, []);

  // Touch events
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches[0]) applyDrag(e.touches[0].clientX);
  }, [applyDrag]);
  const handleTouchEnd = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const startSec = startPct * duration;
  const endSec = endPct * duration;

  const handleClass = "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-accent shadow-md cursor-ew-resize z-10 touch-none";

  return (
    <div className="p-8">
      <div className="text-center mb-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Step 2</p>
        <p className="text-sm text-muted mt-0.5">Drag the handles to choose what to transcribe</p>
      </div>

      <p className="text-center text-sm font-semibold text-text mb-5 truncate px-4">{data.original_name}</p>

      {/* Canvas waveform */}
      <div className="relative mb-2 rounded-xl overflow-hidden border border-border bg-card-hover">
        <canvas ref={canvasRef} width={560} height={80} className="w-full h-20" />

        {/* Drag handles overlay */}
        <div ref={trackRef} className="absolute inset-0">
          {/* Dimmed zones outside selection */}
          <div className="absolute inset-y-0 left-0 bg-white/40" style={{ right: `${(1 - startPct) * 100}%` }} />
          <div className="absolute inset-y-0 right-0 bg-white/40" style={{ left: `${endPct * 100}%` }} />

          {/* Selection border */}
          <div
            className="absolute inset-y-0 border-x-2 border-accent"
            style={{ left: `${startPct * 100}%`, right: `${(1 - endPct) * 100}%` }}
          />

          {/* Start handle */}
          <div
            className={handleClass}
            style={{ left: `${startPct * 100}%` }}
            onMouseDown={() => { dragging.current = "start"; }}
            onTouchStart={() => { dragging.current = "start"; }}
          />

          {/* End handle — both use -translate-x-1/2 so they're centered on their position */}
          <div
            className={handleClass}
            style={{ left: `${endPct * 100}%` }}
            onMouseDown={() => { dragging.current = "end"; }}
            onTouchStart={() => { dragging.current = "end"; }}
          />
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-muted mb-5 px-1">
        <span>START {formatDuration(startSec)}</span>
        <span>END {formatDuration(endSec)}</span>
      </div>

      {/* MIDI Playback */}
      {filename && (
        <div className="mb-6 p-4 bg-card rounded-xl border border-border">
          <MidiPlayer
            fileUrl={`/uploads/${filename}`}
            duration={duration}
            trimStart={startSec}
            trimEnd={endSec}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted hover:text-text transition-colors">← Back</button>
        <button
          onClick={() => onNext({})}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
