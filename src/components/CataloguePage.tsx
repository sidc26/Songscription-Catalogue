"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Music, Search, Heart } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SongGrid } from "./SongGrid";
import { SongDetail } from "./SongDetail";
import { UploadWizard } from "./UploadWizard";
import { ProfilePanel } from "./ProfilePanel";
import { SongscriptionLogo } from "./SongscriptionLogo";
import { getTimeGreeting } from "@/lib/utils";
import type { Song, WizardData } from "@/types";

type ActiveNav = "home" | "library" | "search" | "favorites" | "stats";

function TypedGreeting({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [text]);

  return (
    <h1 className="text-3xl font-bold text-text mb-8">
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-7 bg-accent ml-0.5 align-middle animate-pulse" />
      )}
    </h1>
  );
}

interface Props {
  initialSongs: Song[];
  initialCrates: string[];
}

export function CataloguePage({ initialSongs, initialCrates }: Props) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [crates, setCrates] = useState<string[]>(initialCrates);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(0);
  const [wizardInitialData, setWizardInitialData] = useState<Partial<WizardData>>({});
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<ActiveNav>("home");
  const [loading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const openDetail = useCallback((song: Song) => {
    setActiveSong(song);
    setDetailOpen(true);
  }, []);

  const handleFavorite = useCallback(async (id: number, val: boolean) => {
    setSongs((prev) => prev.map((s) => s.id === id ? { ...s, is_favorite: val } : s));
    try {
      await fetch(`/api/songs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: val }),
      });
    } catch {
      setSongs((prev) => prev.map((s) => s.id === id ? { ...s, is_favorite: !val } : s));
    }
  }, []);

  const handleUpdate = useCallback((updated: Song) => {
    setSongs((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    if (activeSong?.id === updated.id) setActiveSong(updated);
  }, [activeSong]);

  const handleDelete = useCallback((id: number) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (activeSong?.id === id) { setDetailOpen(false); setActiveSong(null); }
  }, [activeSong]);

  const handleCreateCrate = useCallback(async (path: string) => {
    if (!path || path === "Collection") return;
    // Optimistically add this path and all ancestors to local state
    const parts = path.split("/").filter(Boolean);
    const newPaths: string[] = [];
    let built = "";
    for (const p of parts) {
      built = built ? `${built}/${p}` : p;
      newPaths.push(built);
    }
    setCrates((prev) => {
      const s = new Set(prev);
      newPaths.forEach((p) => s.add(p));
      return Array.from(s).sort();
    });
    await fetch("/api/crates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  }, []);

  const handleNewSong = useCallback((song: Song) => {
    setSongs((prev) => [song, ...prev]);
    setActiveNav("library");
    setActiveFolder(null);
    // Ensure the song's folder (if not Collection) exists as a persisted crate
    if (song.folder && song.folder !== "Collection") {
      handleCreateCrate(song.folder);
    }
  }, [handleCreateCrate]);

  const handleDeleteSong = useCallback(async (id: number) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (activeSong?.id === id) { setDetailOpen(false); setActiveSong(null); }
    await fetch(`/api/songs/${id}`, { method: "DELETE" });
  }, [activeSong]);

  const handleDeleteCrate = useCallback(async (crate: string) => {
    const inSubtree = (f: string) => f === crate || f.startsWith(`${crate}/`);
    setSongs((prev) => prev.map((s) => inSubtree(s.folder) ? { ...s, folder: "Collection" } : s));
    setCrates((prev) => prev.filter((c) => !inSubtree(c)));
    if (activeFolder && inSubtree(activeFolder)) setActiveFolder(null);
    const toMove = songs.filter((s) => inSubtree(s.folder));
    await Promise.all([
      ...toMove.map((s) =>
        fetch(`/api/songs/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: "Collection" }),
        })
      ),
      fetch(`/api/crates?path=${encodeURIComponent(crate)}`, { method: "DELETE" }),
    ]);
  }, [songs, activeFolder]);

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("songId", String(id));
    (e.currentTarget as HTMLElement).style.opacity = "0.6";
    (e.currentTarget as HTMLElement).addEventListener("dragend", () => {
      (e.currentTarget as HTMLElement).style.opacity = "";
    }, { once: true });
  }, []);

  const handleDrop = useCallback(async (songId: number, folder: string) => {
    setSongs((prev) => prev.map((s) => s.id === songId ? { ...s, folder } : s));
    await fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
  }, []);

  const openNewTranscription = useCallback(() => {
    setWizardInitialStep(0);
    setWizardInitialData({});
    setWizardOpen(true);
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".mid") && !file.name.endsWith(".midi")) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      setWizardInitialStep(1);
      setWizardInitialData({ filename: json.filename, original_name: json.original_name, midi: json.midi });
      setWizardOpen(true);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }, [uploadFile]);

  const handleCardDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleCardDragLeave = () => setIsDragOver(false);
  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleNavHome = useCallback(() => {
    setActiveNav("home");
    setActiveFolder(null);
  }, []);

  const handleNavLibrary = useCallback(() => {
    setActiveNav("library");
    setActiveFolder(null);
  }, []);

  const handleNavSearch = useCallback(() => {
    setActiveNav("search");
    // Give SongGrid time to render if switching from another state
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const handleNavFavorites = useCallback(() => {
    setActiveNav("favorites");
    setActiveFolder(null);
  }, []);

  const handleNavStats = useCallback(() => {
    setActiveNav("stats");
    setActiveFolder(null);
  }, []);

  // ── Empty-state screens ──────────────────────────────────────────────────
  const emptyLibraryScreen = (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative waveform */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 40 }).map((_, i) => {
            const sinVal = Math.round(Math.sin(i * 0.5) * 80);
            return (
              <rect key={i} x={i * 22} y={100 + sinVal} width={14} height={200 - sinVal} rx={7} fill="#2A9B8A" />
            );
          })}
        </svg>
      </div>

      {/* Floating notes */}
      {(["♩", "♪", "♫", "♬"] as const).map((note, i) => (
        <span
          key={i}
          className="absolute text-muted/20 select-none pointer-events-none"
          style={{ fontSize: `${2 + i * 0.8}rem`, right: `${10 + i * 8}%`, top: `${20 + i * 15}%`, transform: `rotate(${-15 + i * 12}deg)` }}
        >
          {note}
        </span>
      ))}

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg px-6">
        <SongscriptionLogo iconSize={48} showWordmark={false} className="mb-6" />
        <TypedGreeting text={getTimeGreeting()} />

        <input ref={fileInputRef} type="file" accept=".mid,.midi" className="hidden" onChange={handleFileChange} />
        <div
          className={`w-full max-w-sm rounded-2xl cursor-pointer transition-all ${isDragOver ? "scale-105 opacity-90" : "hover:scale-[1.02]"} ${uploading ? "opacity-70 pointer-events-none" : ""}`}
          style={{ backgroundColor: "#2A9B8A" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleCardDragOver}
          onDragLeave={handleCardDragLeave}
          onDrop={handleCardDrop}
        >
          <div className={`m-3 rounded-xl border-2 border-dashed transition-colors p-8 text-center ${isDragOver ? "border-white/80" : "border-white/40"}`}>
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <p className="text-white/80 text-sm">Uploading…</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} className="text-white" />
                </div>
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm mb-3"
                  style={{ backgroundColor: "#F5D547", color: "#1A1A1A" }}
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  Upload your MIDI
                </button>
                <p className="text-white/70 text-sm">Or drag and drop a .mid file</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const emptyFavoritesScreen = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
      <div className="w-16 h-16 rounded-full bg-border flex items-center justify-center">
        <Heart size={28} className="text-muted" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-text mb-1">No favorites yet</p>
        <p className="text-sm text-muted">Heart a transcription to save it here for quick access.</p>
      </div>
    </div>
  );

  const emptySearchScreen = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
      <div className="w-16 h-16 rounded-full bg-border flex items-center justify-center">
        <Search size={28} className="text-muted" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-text mb-1">Nothing to search yet</p>
        <p className="text-sm text-muted">Upload your first transcription to start building your library.</p>
      </div>
      <button
        onClick={openNewTranscription}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
      >
        <Music size={15} />
        Add your first transcription
      </button>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        songs={songs}
        crates={crates}
        activeFolder={activeFolder}
        activeNav={activeNav}
        onFolderClick={(f) => { setActiveNav("library"); setActiveFolder(activeFolder === f ? null : f); }}
        onFolderDoubleClick={(f) => { setActiveNav("library"); setActiveFolder(f === "all" ? null : f); }}
        onSongClick={openDetail}
        onNewTranscription={openNewTranscription}
        onDrop={handleDrop}
        onNavHome={handleNavHome}
        onNavLibrary={handleNavLibrary}
        onNavSearch={handleNavSearch}
        onNavFavorites={handleNavFavorites}
        onNavStats={handleNavStats}
        onCreateCrate={handleCreateCrate}
        onDeleteCrate={handleDeleteCrate}
      />

      <main className="flex-1 flex flex-col overflow-hidden bg-bg">
        {activeNav === "stats" ? (
          <ProfilePanel songs={songs} onClose={handleNavLibrary} />
        ) : activeNav === "favorites" ? (
          songs.filter((s) => s.is_favorite).length === 0 ? emptyFavoritesScreen : (
            <SongGrid
              songs={songs.filter((s) => s.is_favorite)}
              loading={loading}
              activeFolder={null}
              onFavorite={handleFavorite}
              onSongClick={openDetail}
              onDragStart={handleDragStart}
              onNewTranscription={openNewTranscription}
              onDelete={handleDeleteSong}
              searchRef={searchRef}
            />
          )
        ) : activeNav === "home" || songs.length === 0 ? (
          activeNav === "search" && songs.length === 0 ? emptySearchScreen : emptyLibraryScreen
        ) : (
          <>
            {activeFolder && (
              <div className="flex items-center gap-2 px-6 py-2 border-b border-border text-xs text-muted">
                <button onClick={() => setActiveFolder(null)} className="hover:text-text transition-colors">All</button>
                {activeFolder.split("/").map((segment, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <span>/</span>
                    {i < arr.length - 1 ? (
                      <button
                        onClick={() => setActiveFolder(arr.slice(0, i + 1).join("/"))}
                        className="hover:text-text transition-colors"
                      >{segment}</button>
                    ) : (
                      <span className="text-text font-medium">{segment}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            <SongGrid
              songs={songs}
              loading={loading}
              activeFolder={activeFolder}
              onFavorite={handleFavorite}
              onSongClick={openDetail}
              onDragStart={handleDragStart}
              onNewTranscription={openNewTranscription}
              onDelete={handleDeleteSong}
              searchRef={searchRef}
            />
          </>
        )}
      </main>

      <SongDetail
        song={activeSong}
        songs={songs}
        crates={crates}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onCreateCrate={handleCreateCrate}
      />

      <UploadWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={handleNewSong}
        initialStep={wizardInitialStep}
        initialData={wizardInitialData}
        crates={crates}
      />
    </div>
  );
}
