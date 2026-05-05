"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { WizardData, Song } from "@/types";

interface Props {
  data: Partial<WizardData>;
  onComplete: (song: Song) => void;
  onBack: () => void;
  onClose: () => void;
}

export function Step5Copyright({ data, onComplete, onBack, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!confirmed) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to add to library");
      }

      const song: Song = await res.json();
      onComplete(song);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center mb-4">
        <ShieldCheck size={28} className="text-accent" />
      </div>

      <h3 className="text-xl font-bold text-text mb-2">One last thing</h3>
      <p className="text-sm text-muted max-w-sm leading-relaxed mb-6">
        Please confirm you have the rights to transcribe this material, or that this is for personal practice only.
      </p>

      <div className="flex items-start gap-3 text-left mb-6 max-w-sm p-4 rounded-xl border border-border bg-card-hover">
        <Checkbox
          id="copyright"
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="copyright" className="text-sm text-text leading-relaxed cursor-pointer">
          I confirm I have the rights or license to transcribe this material, or this is for personal practice only.
        </Label>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 w-full max-w-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 w-full max-w-sm">
        <button onClick={onBack} className="text-sm text-muted hover:text-text transition-colors">← Back</button>
        <button
          onClick={handleAdd}
          disabled={!confirmed || loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Adding to library…
            </span>
          ) : "Add to Library"}
        </button>
      </div>
    </div>
  );
}
