"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, Youtube, Instagram, Mic } from "lucide-react";
import type { WizardData } from "@/types";

interface Props {
  onNext: (data: Pick<WizardData, "filename" | "original_name" | "midi">) => void;
}

export function Step1Upload({ onNext }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(10);

    const form = new FormData();
    form.append("file", file);

    // Simulate progress
    const interval = setInterval(() => setProgress((p) => Math.min(p + 15, 80)), 300);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      clearInterval(interval);
      setProgress(100);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const data = await res.json();
      setTimeout(() => onNext(data), 300);
    } catch (e: any) {
      clearInterval(interval);
      setError(e.message);
      setProgress(0);
      setUploading(false);
    }
  }, [onNext]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  return (
    <div className="p-8">
      {/* Teal upload card */}
      <div
        className={`relative rounded-2xl p-8 text-center transition-all ${dragging ? "scale-[1.02]" : ""}`}
        style={{ backgroundColor: "#2A9B8A" }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {/* Inner dashed border */}
        <div className="absolute inset-3 rounded-xl border-2 border-dashed border-white/40 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <Upload size={24} className="text-white" />
          </div>

          <div>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm"
              style={{ backgroundColor: "#F5D547", color: "#1A1A1A" }}
            >
              Upload your MIDI
            </button>
            <p className="text-white/70 text-sm mt-2">Or drag and drop here</p>
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px bg-white/30" />
            <span className="text-white/60 text-xs">OR</span>
            <div className="flex-1 h-px bg-white/30" />
          </div>

          {/* Platform row (UI only) */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
            <Youtube size={16} />
            <Instagram size={16} />
            <span className="text-white/70 text-xs">Paste a YouTube / Instagram URL</span>
          </div>

          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/80 cursor-not-allowed"
            style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <Mic size={14} />
            Record Audio
          </button>
        </div>
      </div>

      <input ref={inputRef} type="file" accept=".mid,.midi" className="hidden" onChange={handleChange} />

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
