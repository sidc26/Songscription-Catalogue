"use client";
import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { Search, SlidersHorizontal, ArrowUp, ArrowDown, ChevronDown, LayoutGrid, List } from "lucide-react";
import { SongCard } from "./SongCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import type { Song } from "@/types";

interface Props {
  songs: Song[];
  loading: boolean;
  activeFolder: string | null;
  onFavorite: (id: number, val: boolean) => void;
  onSongClick: (song: Song) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onNewTranscription: () => void;
  onDelete?: (id: number) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

// defaultDir sets the sort direction automatically when switching attributes,
// reflecting natural expectations: newest first for dates, A→Z for text, etc.
// The arrow button in the toolbar can then toggle it from that sensible starting point.
const SORT_OPTIONS = [
  { label: "Recently Accessed", value: "recent", defaultDir: "desc" as const },
  { label: "Date Added", value: "created_at", defaultDir: "desc" as const },
  { label: "Title A–Z", value: "title", defaultDir: "asc" as const },
  { label: "Artist A–Z", value: "artist", defaultDir: "asc" as const },
  { label: "Duration", value: "duration_sec", defaultDir: "asc" as const },
  { label: "Tempo", value: "tempo_bpm", defaultDir: "desc" as const },
];

const FILTER_OPTIONS = {
  genre: ["Classical", "Jazz", "Pop", "Rock", "Electronic", "R&B", "Folk", "Hip-Hop", "Other"],
  mood: ["Energetic", "Melancholic", "Peaceful", "Intense", "Playful", "Romantic", "Mysterious", "Triumphant"],
  difficulty: ["Beginner", "Intermediate", "Advanced", "Expert"],
};

export function SongGrid({ songs, loading, activeFolder, onFavorite, onSongClick, onDragStart, onNewTranscription, onDelete, searchRef }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, string[]>>({ genre: [], mood: [], difficulty: [] });

  const handleSetSort = (val: string) => {
    setSort(val);
    setSortDir(SORT_OPTIONS.find((o) => o.value === val)?.defaultDir ?? "asc");
  };
  // Read the user's last-used view from localStorage so it persists across sessions.
  // The SSR guard prevents a hydration mismatch since localStorage is browser-only.
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("songview") as "grid" | "list") ?? "grid";
    return "grid";
  });

  // Fuse.js runs entirely client-side over the full songs array — no server round-trip.
  // threshold: 0.35 allows minor typos without drowning results in false positives.
  // tags is joined to a string so Fuse can match individual tag words against the query.
  const fuse = useMemo(() => new Fuse(songs, {
    keys: ["title", "artist", "genre", "mood", "key_signature", { name: "tags", getFn: (s) => s.tags.join(" ") }],
    threshold: 0.35,
    includeScore: true,
  }), [songs]);

  const setViewPersist = (v: "grid" | "list") => {
    setView(v);
    localStorage.setItem("songview", v);
  };

  const toggleFilter = (category: string, value: string) => {
    setFilters((prev) => {
      const arr = prev[category];
      return {
        ...prev,
        [category]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const activeFilterCount = Object.values(filters).flat().length;

  const filtered = useMemo(() => {
    // When a search query is active, Fuse returns results sorted by relevance score
    // so the manual sort below is intentionally skipped — score order is more useful.
    let result = query.trim()
      ? fuse.search(query).map((r) => r.item)
      : [...songs];

    if (activeFolder && activeFolder !== "all") {
      result = result.filter((s) => s.folder === activeFolder);
    }

    for (const [cat, vals] of Object.entries(filters)) {
      if (vals.length === 0) continue;
      result = result.filter((s) => {
        const field = s[cat as keyof Song] as string;
        return vals.includes(field);
      });
    }

    if (!query.trim()) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sort) {
          case "title": cmp = a.title.localeCompare(b.title); break;
          case "artist": cmp = (a.artist || "").localeCompare(b.artist || ""); break;
          case "duration_sec": cmp = a.duration_sec - b.duration_sec; break;
          case "tempo_bpm": cmp = a.tempo_bpm - b.tempo_bpm; break;
          case "created_at": cmp = a.created_at.localeCompare(b.created_at); break;
          default: {
            const ta = a.last_played ?? a.created_at;
            const tb = b.last_played ?? b.created_at;
            cmp = ta.localeCompare(tb);
          }
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [songs, query, sort, sortDir, filters, fuse, activeFolder]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <Skeleton className="h-1.5 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full mt-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-bg">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            ref={searchRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, artist, mood, genre, key, tags…"
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors ${activeFilterCount > 0 ? "border-accent bg-accent-muted text-accent" : "border-border bg-card text-text hover:bg-card-hover"}`}>
              <SlidersHorizontal size={14} />
              Filter
              {activeFilterCount > 0 && <span className="ml-0.5 text-xs font-bold">{activeFilterCount}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-0">
            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-1">
              {Object.entries(FILTER_OPTIONS).map(([cat, opts]) => (
                <div key={cat}>
                  <DropdownMenuLabel className="capitalize">{cat}</DropdownMenuLabel>
                  {opts.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt}
                      checked={filters[cat].includes(opt)}
                      onCheckedChange={() => toggleFilter(cat, opt)}
                    >
                      {opt}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort — split button: arrows toggle direction, right side picks attribute */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
            className="flex items-center justify-center h-9 w-9 bg-card text-muted hover:bg-card-hover hover:text-text transition-colors border-r border-border"
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 h-9 px-3 bg-card text-sm text-text hover:bg-card-hover transition-colors">
                {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"}
                <ChevronDown size={12} className="text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => handleSetSort(opt.value)}>
                  {sort === opt.value && <span className="text-accent mr-1">✓</span>}
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* View toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewPersist("grid")}
            className={`p-2 transition-colors ${view === "grid" ? "bg-accent text-white" : "bg-card text-muted hover:bg-card-hover"}`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewPersist("list")}
            className={`p-2 transition-colors ${view === "list" ? "bg-accent text-white" : "bg-card text-muted hover:bg-card-hover"}`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Grid / List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center">
              <Search size={24} className="text-muted" />
            </div>
            <p className="text-lg font-semibold text-text">No transcriptions found</p>
            <p className="text-sm text-muted max-w-xs">
              {query ? `No results for "${query}"` : "This folder is empty."}
            </p>
            <button
              onClick={onNewTranscription}
              className="mt-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Add your first →
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                view="grid"
                onFavorite={onFavorite}
                onClick={onSongClick}
                onDragStart={onDragStart}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                view="list"
                onFavorite={onFavorite}
                onClick={onSongClick}
                onDragStart={onDragStart}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
