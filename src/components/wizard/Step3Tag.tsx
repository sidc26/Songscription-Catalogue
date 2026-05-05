"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { stripExtension } from "@/lib/utils";
import type { WizardData } from "@/types";

const KEY_SIGS = ["C Major","G Major","D Major","A Major","E Major","B Major","F Major","Bb Major","Eb Major","Ab Major","Db Major","Gb Major","A Minor","E Minor","B Minor","F# Minor","C# Minor","G# Minor","D Minor","G Minor","C Minor","F Minor","Bb Minor","Eb Minor"];
const TIME_SIGS = ["4/4","3/4","6/8","2/4","5/4","7/8","12/8"];
const GENRES = ["Classical","Jazz","Pop","Rock","Electronic","R&B","Folk","Hip-Hop","Other"];
const MOODS = ["Energetic","Melancholic","Peaceful","Intense","Playful","Romantic","Mysterious","Triumphant"];
const INSTRUMENTS = ["Piano","Guitar","Bass","Violin","Cello","Saxophone","Trumpet","Drums","Voice","Other"];
const DIFFICULTIES = ["Beginner","Intermediate","Advanced","Expert"];

interface Props {
  data: Partial<WizardData>;
  onNext: (data: Partial<WizardData>) => void;
  onBack: () => void;
  crates?: string[];
}

export function Step3Tag({ data, onNext, onBack, crates = [] }: Props) {
  const [form, setForm] = useState({
    title: data.title || stripExtension(data.original_name ?? ""),
    artist: data.artist || "",
    instrument: data.instrument || "",
    genre: data.genre || "",
    mood: data.mood || "",
    difficulty: data.difficulty || "",
    folder: data.folder || "Collection",
    tags: data.tags || "",
    key_signature: data.key_signature || "",
    time_signature: data.time_signature || "",
  });
  const [betaTooltip, setBetaTooltip] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const showBeta = (field: string) => {
    setBetaTooltip(field);
    setTimeout(() => setBetaTooltip(null), 2000);
  };

  return (
    <TooltipProvider>
      <div className="p-8 overflow-y-auto max-h-[70vh] scrollbar-thin">
        <div className="grid grid-cols-2 gap-4">
          {/* Title */}
          <div className="col-span-2">
            <Label htmlFor="title" className="mb-1 block">Song title</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Enter title" />
          </div>

          {/* Artist */}
          <div className="col-span-2">
            <Label htmlFor="artist" className="mb-1 block">Artist / Composer <span className="text-muted font-normal">(optional)</span></Label>
            <Input id="artist" value={form.artist} onChange={(e) => set("artist", e.target.value)} placeholder="e.g. Miles Davis" />
          </div>

          {/* Instrument */}
          <div>
            <Label className="mb-1 block">Target instrument</Label>
            <Select value={form.instrument || "__none"} onValueChange={(v) => set("instrument", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Select —</SelectItem>
                {INSTRUMENTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Genre */}
          <div>
            <Label className="mb-1 block">Genre</Label>
            <Select value={form.genre || "__none"} onValueChange={(v) => set("genre", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Select —</SelectItem>
                {GENRES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Mood */}
          <div>
            <Label className="mb-1 block">Mood</Label>
            <Select value={form.mood || "__none"} onValueChange={(v) => set("mood", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select mood" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Select —</SelectItem>
                {MOODS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty */}
          <div>
            <Label className="mb-1 block">Difficulty</Label>
            <Select value={form.difficulty || "__none"} onValueChange={(v) => set("difficulty", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Select —</SelectItem>
                {DIFFICULTIES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Key Signature + Beta */}
          <div>
            <Label className="mb-1 block">Key Signature</Label>
            <Select value={form.key_signature || "__none"} onValueChange={(v) => set("key_signature", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select key" /></SelectTrigger>
              <SelectContent>
                <Tooltip open={betaTooltip === "key"}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => showBeta("key")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent-muted transition-colors rounded"
                    >
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent text-[9px] font-semibold">BETA</span>
                      Predict automatically
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>AI prediction coming soon</TooltipContent>
                </Tooltip>
                <div className="h-px bg-border mx-1 my-1" />
                <SelectItem value="__none">— Select —</SelectItem>
                {KEY_SIGS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Time Signature + Beta */}
          <div>
            <Label className="mb-1 block">Time Signature</Label>
            <Select value={form.time_signature || "__none"} onValueChange={(v) => set("time_signature", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select time sig" /></SelectTrigger>
              <SelectContent>
                <Tooltip open={betaTooltip === "time"}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => showBeta("time")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent-muted transition-colors rounded"
                    >
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent text-[9px] font-semibold">BETA</span>
                      Predict automatically
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>AI prediction coming soon</TooltipContent>
                </Tooltip>
                <div className="h-px bg-border mx-1 my-1" />
                <SelectItem value="__none">— Select —</SelectItem>
                {TIME_SIGS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Crate */}
          <div className="col-span-2">
            <Label htmlFor="folder" className="mb-1 block">Crate</Label>
            <div className="flex gap-2">
              <Input
                id="folder"
                value={form.folder}
                onChange={(e) => set("folder", e.target.value)}
                placeholder="Library"
                list="folders-list"
                className="flex-1"
              />
            </div>
            <datalist id="folders-list">
              <option value="Collection" />
              {crates.map((c) => <option key={c} value={c} />)}
            </datalist>
            <p className="text-[11px] text-muted mt-1">Type an existing crate or enter a new name to create one.</p>
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags" className="mb-1 block">Tags <span className="text-muted font-normal">(comma-separated)</span></Label>
            <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="bebop, swing, standard" />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button onClick={onBack} className="text-sm text-muted hover:text-text transition-colors">← Back</button>
          <button
            onClick={() => onNext(form)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Continue <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
