"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Repeat } from "lucide-react";
import { Minus, Plus } from "lucide-react";
import { formatDuration } from "@/lib/utils";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface MidiPlayerProps {
  fileUrl: string;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  compact?: boolean;
}

export function MidiPlayer({ fileUrl, duration, trimStart = 0, trimEnd, compact = false }: MidiPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const tickRef = useRef<number | null>(null);
  const effectiveDuration = trimEnd ?? duration;

  useEffect(() => {
    let mounted = true;
    let player: any;

    // Dynamic import keeps TonePlayer (and its Web Audio API usage) out of the
    // SSR bundle. This effect re-runs whenever fileUrl changes so switching songs
    // in the detail panel tears down the old player and loads the new file.
    import("@/lib/tone-player").then(({ TonePlayer }) => {
      player = new TonePlayer();
      playerRef.current = player;

      player
        .load(fileUrl)
        .then(() => {
          if (mounted) {
            setIsLoaded(true);
            if (trimStart > 0) player.seek(trimStart);
          }
        })
        .catch((err: unknown) => {
          if (mounted) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(`Failed to load MIDI: ${msg}`);
          }
        });
    });

    return () => {
      // mounted flag prevents setState calls after unmount when the async load
      // resolves after the component has already been removed from the tree.
      mounted = false;
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      player?.dispose();
    };
  }, [fileUrl, trimStart]);

  // requestAnimationFrame drives the scrubber UI at ~60 fps. Using rAF instead of
  // setInterval avoids accumulating stale frames when the tab is in the background.
  const tick = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const t = p.getCurrentTime();
    setCurrentTime(Math.min(t, effectiveDuration));
    if (t >= effectiveDuration) {
      setIsPlaying(false);
      p.stop();
    } else {
      tickRef.current = requestAnimationFrame(tick);
    }
  }, [effectiveDuration]);

  useEffect(() => {
    if (isPlaying) {
      tickRef.current = requestAnimationFrame(tick);
    } else {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    }
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
  }, [isPlaying, tick]);

  const handlePlayPause = async () => {
    const p = playerRef.current;
    if (!p || !isLoaded) return;
    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
    } else {
      await p.play();
      setIsPlaying(true);
    }
  };

  // pct is 0–1 relative to the trimmed region, not the full file duration.
  // Seek within [trimStart, effectiveDuration] keeps trim boundaries respected.
  const handleSeek = (pct: number) => {
    const t = trimStart + pct * (effectiveDuration - trimStart);
    playerRef.current?.seek(t);
    setCurrentTime(t);
  };

  const handleSpeedChange = (delta: number) => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, idx + delta))];
    setSpeed(next);
    playerRef.current?.setSpeed(next);
  };

  const handleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    playerRef.current?.setLoop(next);
  };

  const played = effectiveDuration > 0 ? (currentTime - trimStart) / (effectiveDuration - trimStart) : 0;

  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* Scrubber */}
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-muted w-10">{formatDuration(currentTime)}</span>
        <div
          className="flex-1 relative h-1.5 rounded-full bg-border cursor-pointer group"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            handleSeek((e.clientX - r.left) / r.width);
          }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all" style={{ width: `${played * 100}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${played * 100}% - 6px)` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted w-10 text-right">{formatDuration(effectiveDuration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={!isLoaded}
            className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover disabled:opacity-40 transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={15} fill="white" /> : <Play size={15} fill="white" />}
          </button>
          <button
            onClick={handleLoop}
            className={`p-1.5 rounded-lg transition-colors ${isLooping ? "text-accent bg-accent-muted" : "text-muted hover:text-text"}`}
            aria-label="Toggle loop"
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Speed control */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSpeedChange(-1)}
              disabled={speed <= SPEEDS[0]}
              className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-accent-hover transition-colors"
            >
              <Minus size={11} />
            </button>
            <span className="text-sm font-semibold w-10 text-center tabular-nums">{speed}×</span>
            <button
              onClick={() => handleSpeedChange(1)}
              disabled={speed >= SPEEDS[SPEEDS.length - 1]}
              className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-accent-hover transition-colors"
            >
              <Plus size={11} />
            </button>
          </div>
          <span className="text-[10px] text-muted">Speed</span>
        </div>
      </div>
    </div>
  );
}
