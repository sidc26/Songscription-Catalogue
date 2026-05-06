"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Heart, Share2, Trash2, Lock, X, Crown, Music4
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AISummary } from "./AISummary";
import { formatDuration, formatDate, cardColor } from "@/lib/utils";
import type { Song, AISummary as AISummaryType } from "@/types";

// MidiPlayer uses the Web Audio API which is browser-only; ssr: false prevents
// Next.js from attempting to render it during SSR where AudioContext is undefined.
const MidiPlayer = dynamic(() => import("./MidiPlayer").then((m) => ({ default: m.MidiPlayer })), { ssr: false });

const KEY_SIGS = ["C Major","G Major","D Major","A Major","E Major","B Major","F Major","Bb Major","Eb Major","Ab Major","Db Major","Gb Major","A Minor","E Minor","B Minor","F# Minor","C# Minor","G# Minor","D Minor","G Minor","C Minor","F Minor","Bb Minor","Eb Minor"];
const TIME_SIGS = ["4/4","3/4","6/8","2/4","5/4","7/8","12/8"];
const GENRES = ["Classical","Jazz","Pop","Rock","Electronic","R&B","Folk","Hip-Hop","Other"];
const MOODS = ["Energetic","Melancholic","Peaceful","Intense","Playful","Romantic","Mysterious","Triumphant"];
const INSTRUMENTS = ["Piano","Guitar","Bass","Violin","Cello","Saxophone","Trumpet","Drums","Voice","Other"];
const DIFFICULTIES = ["Beginner","Intermediate","Advanced","Expert"];
// Monetisation: sharing is free (viral growth driver).
// PDF export is gated — a clean download replaces the platform for some users permanently.
// MIDI download removed: the user uploaded it themselves; offering it back adds no value.

interface Props {
  song: Song | null;
  songs: Song[];
  crates: string[];
  open: boolean;
  onClose: () => void;
  onUpdate: (updated: Song) => void;
  onDelete: (id: number) => void;
  onCreateCrate?: (path: string) => void;
}

const OPTIONAL_FIELDS: { key: keyof Song; label: string }[] = [
  { key: "artist", label: "Artist" },
  { key: "genre", label: "Genre" },
  { key: "mood", label: "Mood" },
  { key: "instrument", label: "Instrument" },
  { key: "difficulty", label: "Difficulty" },
  { key: "key_signature", label: "Key Signature" },
  { key: "time_signature", label: "Time Signature" },
  { key: "tags", label: "Tags" },
];

function getMissingFields(song: Song): string[] {
  return OPTIONAL_FIELDS.filter(({ key }) => {
    const v = song[key];
    return !v || (Array.isArray(v) && v.length === 0) || v === "";
  }).map(({ label }) => label);
}

export function SongDetail({ song, songs, crates, open, onClose, onUpdate, onDelete, onCreateCrate }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);
  const [folderQuery, setFolderQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [dismissedBannerId, setDismissedBannerId] = useState<number | null>(null);

  // Optimistic PATCH: apply fields immediately for responsiveness, then reconcile
  // with the server response (which may differ, e.g. after server-side coercions).
  // On failure the original song is restored so the UI stays truthful.
  const patch = useCallback(async (fields: Partial<Song>) => {
    if (!song) return;
    const optimistic = { ...song, ...fields };
    onUpdate(optimistic);
    try {
      const res = await fetch(`/api/songs/${song.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) onUpdate(await res.json());
      else onUpdate(song);
    } catch {
      onUpdate(song);
    }
  }, [song, onUpdate]);

  // Called when the dialog opens (via Dialog's onOpenChange). Incrementing play_count
  // here (not on actual audio play) is intentional — opening the detail view counts
  // as "practiced" for the purposes of streak and engagement tracking.
  const handleOpen = useCallback(async () => {
    if (!song) return;
    const now = new Date().toISOString();
    await fetch(`/api/songs/${song.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_played: now, play_count: song.play_count + 1 }),
    });
    onUpdate({ ...song, last_played: now, play_count: song.play_count + 1 });
  }, [song, onUpdate]);

  const handleShare = async () => {
    if (!song) return;
    // Sharing is intentionally unlimited — it drives viral discovery.
    const url = `https://songscription.app/s/${song.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await patch({ share_count: song.share_count + 1 });
  };

  const handleDelete = async () => {
    if (!song) return;
    await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
    onDelete(song.id);
    onClose();
  };

  const handleMoveFolder = async (folder: string) => {
    const trimmed = folder.trim();
    if (!trimmed) return;
    // Persist as a crate if it doesn't already exist
    if (!allCrates.includes(trimmed)) onCreateCrate?.(trimmed);
    await patch({ folder: trimmed });
    setFolderQuery("");
  };

  // Union of persisted crates and any folder that a song already references —
  // handles the edge case where a crate was deleted but songs still point to it.
  const allCrates = Array.from(
    new Set(["Collection", ...crates, ...songs.map((s) => s.folder)])
  ).sort();

  if (!song) return null;

  const color = cardColor(song.mood);

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden max-h-[90vh]" hideClose>
          {/* Color strip */}
          <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: color }} />

          <div className="flex overflow-hidden" style={{ maxHeight: "calc(90vh - 6px)" }}>
            {/* LEFT COLUMN */}
            <div className="flex-[3] p-6 overflow-y-auto scrollbar-thin border-r border-border">
              {/* Close */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mr-4">
                  <InlineEdit
                    value={song.title}
                    onSave={(v) => patch({ title: v })}
                    className="text-xl font-bold text-text"
                    placeholder="Song title"
                  />
                  <InlineEdit
                    value={song.artist}
                    onSave={(v) => patch({ artist: v })}
                    className="text-sm text-muted mt-0.5"
                    placeholder="Artist"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={song.transcription_type === "direct" ? "default" : "outline"}>
                      {song.transcription_type === "direct" ? "Direct Transcription" : "Arrangement"}
                    </Badge>
                    {song.instrument && <Badge variant="muted">{song.instrument}</Badge>}
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* MIDI Player */}
              <div className="mb-6 p-4 bg-card-hover rounded-xl border border-border">
                <MidiPlayer
                  fileUrl={`/uploads/${song.filename}`}
                  duration={song.duration_sec}
                />
              </div>

              {/* Transcription view placeholder */}
              <div className="mb-4 flex items-center justify-center bg-card-hover border border-dashed border-border rounded-xl h-44">
                <div className="text-center">
                  <p className="text-sm font-medium text-muted">Transcription view</p>
                  <p className="text-xs text-muted/60 mt-1 italic">Coming in a future release</p>
                </div>
              </div>

              {/* Practice CTA */}
              <div className="mb-4 rounded-xl border border-accent/30 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(42,155,138,0.08) 0%, rgba(42,155,138,0.03) 100%)" }}>
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text">Ready to practice?</p>
                    <p className="text-xs text-muted mt-0.5">Interactive piano roll coming soon</p>
                  </div>
                  <button
                    disabled
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white cursor-not-allowed opacity-60 shrink-0"
                    style={{ backgroundColor: "#2A9B8A" }}
                    title="Piano roll practice mode — coming soon"
                  >
                    <Music4 size={15} />
                    Practice
                  </button>
                </div>
                {/* Piano roll placeholder */}
                <div className="mx-4 mb-4 flex items-center justify-center bg-[#0D0D0D]/5 border border-dashed border-accent/20 rounded-lg h-36">
                  <div className="text-center">
                    <div className="flex justify-center gap-0.5 mb-2">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2 rounded-sm opacity-20"
                          style={{
                            backgroundColor: "#2A9B8A",
                            height: `${18 + Math.sin(i * 0.9) * 14}px`,
                            marginTop: `${14 - Math.sin(i * 0.9) * 14}px`,
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted italic">Piano roll — coming in a future release</p>
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              <AISummary
                song={song}
                onSummaryGenerated={(summary) => patch({ ai_summary: summary as AISummaryType })}
              />
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex-[2] p-5 overflow-y-auto scrollbar-thin">
              {/* Incomplete fields banner */}
              {(() => {
                const missing = getMissingFields(song);
                if (missing.length === 0 || dismissedBannerId === song.id) return null;
                return (
                  <div className="flex items-start gap-2 mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-800 mb-0.5">Complete your song details</p>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        {missing.join(", ")} {missing.length === 1 ? "is" : "are"} empty — fill them in below to improve search and AI summaries.
                      </p>
                    </div>
                    <button
                      onClick={() => setDismissedBannerId(song.id)}
                      className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors mt-0.5"
                      aria-label="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div className="flex items-center gap-2 mb-5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => patch({ is_favorite: !song.is_favorite })}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-sm transition-colors ${song.is_favorite ? "border-accent bg-accent-muted text-accent" : "border-border hover:bg-card-hover text-text"}`}
                    >
                      <Heart size={14} fill={song.is_favorite ? "currentColor" : "none"} />
                      {song.is_favorite ? "Favorited" : "Favorite"}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle favorite</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border hover:bg-card-hover text-sm text-text transition-colors"
                    >
                      <Share2 size={14} />
                      {copied ? "Copied!" : "Share"}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copy shareable link — always free</TooltipContent>
                </Tooltip>
              </div>

              {/* Download — PDF gated (Pro), MIDI not offered */}
              <div className="mb-5 p-3 border border-border rounded-xl">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Download</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted cursor-not-allowed bg-card-hover mb-1">
                      <Lock size={12} />
                      <span>PDF Sheet Music</span>
                      <Badge variant="muted" className="ml-auto text-[9px]">Pro</Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Upgrade to Pro to export clean PDF sheet music</TooltipContent>
                </Tooltip>
                {["MusicXML", "MP3"].map((fmt) => (
                  <div key={fmt} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted cursor-not-allowed opacity-50">
                    <Lock size={12} />
                    <span>{fmt}</span>
                    <Badge variant="muted" className="ml-auto text-[9px]">Pro</Badge>
                  </div>
                ))}
              </div>

              {/* Metadata fields */}
              <div className="space-y-3 mb-5">
                <FieldWithBeta
                  label="Key Signature"
                  options={KEY_SIGS}
                  value={song.key_signature}
                  onSave={(v) => patch({ key_signature: v })}
                />
                <FieldWithBeta
                  label="Time Signature"
                  options={TIME_SIGS}
                  value={song.time_signature}
                  onSave={(v) => patch({ time_signature: v })}
                />
                <SelectField label="Genre" options={GENRES} value={song.genre} onSave={(v) => patch({ genre: v })} />
                <SelectField label="Mood" options={MOODS} value={song.mood} onSave={(v) => patch({ mood: v })} />
                <SelectField label="Instrument" options={INSTRUMENTS} value={song.instrument} onSave={(v) => patch({ instrument: v })} />
                <SelectField label="Difficulty" options={DIFFICULTIES} value={song.difficulty} onSave={(v) => patch({ difficulty: v })} />

                {/* Tags */}
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Tags</p>
                  <InlineEdit
                    value={song.tags.join(", ")}
                    onSave={(v) => patch({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) as any })}
                    className="text-sm text-text"
                    placeholder="comma, separated, tags"
                  />
                  {song.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {song.tags.map((t) => <Badge key={t} variant="muted">{t}</Badge>)}
                    </div>
                  )}
                </div>

                {/* Crate */}
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Crate</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text">{song.folder}</span>
                    <Popover onOpenChange={(o) => { if (!o) setFolderQuery(""); }}>
                      <PopoverTrigger asChild>
                        <button className="text-xs text-accent hover:underline">Move to…</button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-56" align="start">
                        {/* Filter / new-crate input */}
                        <div className="px-2 pt-2 pb-1">
                          <input
                            autoFocus
                            type="text"
                            value={folderQuery}
                            onChange={(e) => setFolderQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const match = allCrates.find(
                                  (f) => f.toLowerCase() === folderQuery.trim().toLowerCase()
                                );
                                handleMoveFolder(match ?? folderQuery);
                              }
                            }}
                            placeholder="Search or create crate…"
                            className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card-hover outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-muted"
                          />
                        </div>

                        {/* Filtered crate list */}
                        <div className="max-h-52 overflow-y-auto scrollbar-thin px-1 pb-1">
                          {allCrates
                            .filter((f) =>
                              !folderQuery.trim() ||
                              f.toLowerCase().includes(folderQuery.trim().toLowerCase())
                            )
                            .map((f) => (
                              <button
                                key={f}
                                onClick={() => handleMoveFolder(f)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                                  f === song.folder
                                    ? "text-accent font-semibold bg-accent-muted"
                                    : "text-text hover:bg-card-hover"
                                }`}
                              >
                                {f}
                                {f === song.folder && (
                                  <span className="ml-1 text-[10px] text-muted font-normal">current</span>
                                )}
                              </button>
                            ))}

                          {/* "Create new" option when query doesn't match any existing crate */}
                          {folderQuery.trim() &&
                            !allCrates.some(
                              (f) => f.toLowerCase() === folderQuery.trim().toLowerCase()
                            ) && (
                              <button
                                onClick={() => handleMoveFolder(folderQuery)}
                                className="w-full text-left px-3 py-2 rounded-lg text-xs text-accent hover:bg-accent-muted transition-colors border-t border-border mt-1 pt-2"
                              >
                                Create &amp; move to "{folderQuery.trim()}"
                              </button>
                            )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-3 bg-card-hover rounded-xl border border-border mb-5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">File info</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {[
                    ["Duration", formatDuration(song.duration_sec)],
                    ["Tempo", `${Math.round(song.tempo_bpm)} BPM`],
                    ["Notes", song.note_count.toLocaleString()],
                    ["Tracks", song.track_count],
                    ["Format", `MIDI ${song.format}`],
                    ["Ticks/QN", song.ticks_per_qn],
                    ["Practiced", `${song.play_count}×`],
                    ["Last played", formatDate(song.last_played)],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <span className="text-muted">{k}: </span>
                      <span className="text-text font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Delete transcription
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{song.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the transcription and its MIDI file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pro dialog */}
      <AlertDialog open={showProDialog} onOpenChange={setShowProDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown size={18} className="text-accent-yellow" />
              Share limit reached
            </AlertDialogTitle>
            <AlertDialogDescription>
              You've shared this transcription 5 times. Upgrade to Pro to share unlimited transcriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe later</AlertDialogCancel>
            <AlertDialogAction>Upgrade to Pro</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

function InlineEdit({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => { setEditing(false); if (draft !== value) onSave(draft); };

  if (editing) {
    return (
      <input
        autoFocus
        className={`bg-transparent border-b border-accent outline-none ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:opacity-70 transition-opacity ${className} ${!value ? "text-muted italic" : ""}`}
    >
      {value || placeholder}
    </span>
  );
}

function SelectField({ label, options, value, onSave }: { label: string; options: string[]; value: string; onSave: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted mb-1">{label}</p>
      {/* "__none" sentinel avoids the empty-string issue in Radix Select, which
          treats an empty value as "uncontrolled". Saving "__none" clears the field. */}
      <Select value={value || "__none"} onValueChange={(v) => onSave(v === "__none" ? "" : v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— None —</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldWithBeta({ label, options, value, onSave }: { label: string; options: string[]; value: string; onSave: (v: string) => void }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        <TooltipProvider>
          <Tooltip open={showTooltip}>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setShowTooltip(true); setTimeout(() => setShowTooltip(false), 2000); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent text-accent text-[9px] font-semibold"
              >
                BETA Predict
              </button>
            </TooltipTrigger>
            <TooltipContent>AI prediction coming soon</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Select value={value || "__none"} onValueChange={(v) => onSave(v === "__none" ? "" : v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— None —</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
