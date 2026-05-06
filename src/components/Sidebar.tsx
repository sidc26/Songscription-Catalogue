"use client";
import { useState, useRef } from "react";
import { Music, Search, Heart, BarChart3, MessageSquare, PanelLeft, ChevronRight, ChevronDown, FolderOpen, Plus, Trash2 } from "lucide-react";
import { SongscriptionLogo } from "./SongscriptionLogo";
import type { Song } from "@/types";

interface Props {
  songs: Song[];
  crates: string[];
  activeFolder: string | null;
  activeNav?: "home" | "library" | "search" | "favorites" | "stats";
  onFolderClick: (folder: string) => void;
  onFolderDoubleClick: (folder: string) => void;
  onSongClick: (song: Song) => void;
  onNewTranscription: () => void;
  onDrop: (songId: number, folder: string) => void;
  onNavHome?: () => void;
  onNavLibrary?: () => void;
  onNavSearch?: () => void;
  onNavFavorites?: () => void;
  onNavStats?: () => void;
  onCreateCrate?: (path: string) => void;
  onDeleteCrate?: (crate: string) => void;
}

interface TreeNode {
  name: string;
  path: string; // full slash-separated path, e.g. "Jazz/Bebop"
  children: TreeNode[];
  directCount: number;
}

// Reconstructs a TreeNode hierarchy from the flat list of slash-separated crate paths.
// Crates are stored as TEXT paths in the DB (e.g. "Jazz/Bebop"); this function is the
// only place that converts them into a nested tree structure for rendering.
function buildTree(songs: Song[], customCrates: string[]): TreeNode[] {
  const allPaths = new Set<string>();

  for (const s of songs) {
    if (s.folder && s.folder !== "Collection") {
      // Expand "Jazz/Bebop" into ["Jazz", "Jazz/Bebop"] so every ancestor always has
      // a node, even if the intermediate crate was never explicitly created.
      const parts = s.folder.split("/").filter(Boolean);
      let built = "";
      for (const p of parts) {
        built = built ? `${built}/${p}` : p;
        allPaths.add(built);
      }
    }
  }
  for (const c of customCrates) {
    if (c && c !== "Collection") allPaths.add(c);
  }

  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Sort guarantees parents are inserted before their children so parent lookups
  // always succeed (e.g. "Jazz" is processed before "Jazz/Bebop").
  for (const path of Array.from(allPaths).sort()) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : null;
    const node: TreeNode = { name, path, children: [], directCount: 0 };
    nodeMap.set(path, node);
    if (parentPath) {
      const parent = nodeMap.get(parentPath);
      if (parent) parent.children.push(node);
      // Parent missing means it was deleted while songs still reference the child —
      // promote to root rather than silently hiding the crate.
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const s of songs) {
    if (s.folder && s.folder !== "Collection") {
      const n = nodeMap.get(s.folder);
      if (n) n.directCount++;
    }
  }

  return roots;
}

export function Sidebar({
  songs, crates, activeFolder, activeNav = "home", onFolderClick, onFolderDoubleClick,
  onSongClick, onNewTranscription, onDrop, onNavHome, onNavLibrary, onNavSearch, onNavFavorites, onNavStats, onCreateCrate, onDeleteCrate,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["__collection__"]));
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [newCrateName, setNewCrateName] = useState("");
  const [confirmDeleteCrate, setConfirmDeleteCrate] = useState<string | null>(null);
  const crateInputRef = useRef<HTMLInputElement>(null);

  const crateTree = buildTree(songs, crates);

  // Falls back to created_at when a song has never been played, mirroring the
  // "recent" sort in the API so both lists feel consistent.
  const recents = [...songs].sort((a, b) => {
    const ta = a.last_played ?? a.created_at;
    const tb = b.last_played ?? b.created_at;
    return tb.localeCompare(ta);
  }).slice(0, 3);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const startAdding = (parentPath: string) => {
    setAddingUnder(parentPath);
    setTimeout(() => crateInputRef.current?.focus(), 0);
  };

  const commitNewCrate = () => {
    const name = newCrateName.trim();
    if (name && addingUnder !== null) {
      const fullPath = addingUnder ? `${addingUnder}/${name}` : name;
      if (fullPath !== "Collection") {
        onCreateCrate?.(fullPath);
        if (addingUnder) setExpandedFolders((prev) => new Set([...prev, addingUnder]));
      }
    }
    setNewCrateName("");
    setAddingUnder(null);
  };

  const handleDragOver = (e: React.DragEvent, folder: string) => { e.preventDefault(); setDragOverFolder(folder); };
  const handleDragLeave = () => setDragOverFolder(null);
  const handleDrop = (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    const songId = parseInt(e.dataTransfer.getData("songId"), 10);
    if (!isNaN(songId)) onDrop(songId, folder);
    setDragOverFolder(null);
  };

  const folderSongs = (path: string) => songs.filter((s) => s.folder === path);

  // Recursive crate renderer
  function renderCrateNode(node: TreeNode, depth: number) {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFolder === node.path;
    const isDragOver = dragOverFolder === node.path;
    const isConfirming = confirmDeleteCrate === node.path;
    const isAddingChild = addingUnder === node.path;
    const indentPx = depth * 14;
    const direct = folderSongs(node.path);

    if (isConfirming) {
      return (
        <div key={node.path} style={{ paddingLeft: indentPx }} className="mx-1 mb-0.5">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <span className="text-[10px] text-red-600 flex-1 truncate">Delete "{node.name}"?</span>
            <button
              onClick={() => {
                onDeleteCrate?.(node.path);
                setConfirmDeleteCrate(null);
              }}
              className="text-[10px] text-red-600 font-semibold hover:underline"
            >Yes</button>
            <span className="text-[10px] text-muted">/</span>
            <button onClick={() => setConfirmDeleteCrate(null)} className="text-[10px] text-muted hover:text-text">No</button>
          </div>
        </div>
      );
    }

    return (
      <div key={node.path}>
        {/* A <div role="button"> is used instead of <button> because this element
            contains <button> children (add subcrate, delete). HTML forbids nesting
            interactive elements inside <button>. */}
        <div
          role="button"
          tabIndex={0}
          style={{ paddingLeft: indentPx + 8 }}
          onClick={() => { toggleFolder(node.path); onFolderClick(node.path); }}
          onDoubleClick={() => onFolderDoubleClick(node.path)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFolder(node.path); onFolderClick(node.path); } }}
          onDragOver={(e) => handleDragOver(e, node.path)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.path)}
          className={`w-full flex items-center gap-1.5 pr-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer select-none group/crate ${
            isActive
              ? "bg-accent-muted text-accent border-l-[2px] border-accent"
              : isDragOver
              ? "bg-accent-muted border-l-[2px] border-accent"
              : "text-text hover:bg-card-hover"
          }`}
        >
          {isExpanded ? <ChevronDown size={10} className="shrink-0 text-muted" /> : <ChevronRight size={10} className="shrink-0 text-muted" />}
          <FolderOpen size={12} className="shrink-0 text-muted" />
          <span className="truncate flex-1 text-left">{node.name}</span>
          <span className="text-[9px] text-muted shrink-0 group-hover/crate:hidden">{node.directCount}</span>
          <div className="hidden group-hover/crate:flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); startAdding(node.path); }}
              className="p-0.5 text-muted hover:text-accent transition-colors"
              aria-label="Add subcrate"
            >
              <Plus size={9} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteCrate(node.path); }}
              className="p-0.5 text-muted hover:text-red-500 transition-colors"
              aria-label={`Delete ${node.name}`}
            >
              <Trash2 size={9} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div>
            {direct.map((s) => (
              <button
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("songId", String(s.id))}
                onClick={() => onSongClick(s)}
                style={{ paddingLeft: indentPx + 22 }}
                className="w-full text-left pr-2 py-1.5 rounded text-xs text-muted hover:text-text hover:bg-card-hover transition-colors truncate cursor-grab active:cursor-grabbing"
              >
                {s.title}
              </button>
            ))}

            {node.children.map((child) => renderCrateNode(child, depth + 1))}

            {isAddingChild && (
              <div style={{ paddingLeft: indentPx + 18 }} className="mb-1 mr-2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card-hover border border-accent/40">
                <FolderOpen size={11} className="text-muted shrink-0" />
                <input
                  ref={crateInputRef}
                  value={newCrateName}
                  onChange={(e) => setNewCrateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNewCrate();
                    if (e.key === "Escape") { setAddingUnder(null); setNewCrateName(""); }
                  }}
                  onBlur={commitNewCrate}
                  placeholder="Subcrate name…"
                  className="flex-1 text-xs bg-transparent outline-none text-text placeholder:text-muted"
                />
              </div>
            )}

            {node.children.length === 0 && direct.length === 0 && !isAddingChild && (
              <p style={{ paddingLeft: indentPx + 22 }} className="pr-2 py-1.5 text-xs text-muted italic">Empty</p>
            )}
          </div>
        )}
      </div>
    );
  }

  const isCollectionExpanded = expandedFolders.has("__collection__");
  const isCollectionActive = activeFolder === null && activeNav === "library";
  const collectionSongs = folderSongs("Collection");

  if (collapsed) {
    return (
      <aside className="w-14 h-screen flex flex-col items-center py-4 gap-4 border-r border-border bg-sidebar shrink-0">
        <button onClick={onNavHome} aria-label="Home">
          <SongscriptionLogo showWordmark={false} iconSize={22} />
        </button>
        <button onClick={() => setCollapsed(false)} className="p-2 rounded-lg hover:bg-card-hover text-muted">
          <PanelLeft size={18} />
        </button>
        <button onClick={onNewTranscription} className="p-2 rounded-full bg-accent text-white hover:bg-accent-hover">
          <Plus size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[220px] h-screen flex flex-col border-r border-border bg-sidebar shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onNavHome} className="hover:opacity-70 transition-opacity" aria-label="Home">
          <SongscriptionLogo iconSize={20} />
        </button>
        <button onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
          <PanelLeft size={16} />
        </button>
      </div>

      {/* New Transcription */}
      <div className="px-3 pb-3">
        <button
          onClick={onNewTranscription}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus size={15} />
          New Transcription
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2 space-y-0.5">
        <button
          onClick={onNavLibrary}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            activeNav === "library" ? "bg-accent-muted text-accent font-medium" : "text-text hover:bg-card-hover"
          }`}
        >
          <Music size={15} className={activeNav === "library" ? "text-accent" : "text-muted"} />
          Transcriptions
        </button>
        <button
          onClick={onNavFavorites}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            activeNav === "favorites" ? "bg-accent-muted text-accent font-medium" : "text-text hover:bg-card-hover"
          }`}
        >
          <Heart size={15} className={activeNav === "favorites" ? "text-accent fill-accent" : "text-muted"} />
          Favorites
        </button>
        <button
          onClick={onNavSearch}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            activeNav === "search" ? "bg-accent-muted text-accent font-medium" : "text-text hover:bg-card-hover"
          }`}
        >
          <Search size={15} className={activeNav === "search" ? "text-accent" : "text-muted"} />
          Search
        </button>
        <button
          onClick={onNavStats}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            activeNav === "stats" ? "bg-accent-muted text-accent font-medium" : "text-text hover:bg-card-hover"
          }`}
        >
          <BarChart3 size={15} className={activeNav === "stats" ? "text-accent" : "text-muted"} />
          My Profile
        </button>
      </nav>

      <div className="flex-1 overflow-y-auto scrollbar-thin mt-2">
        {/* Recents */}
        {recents.length > 0 && (
          <div className="px-2 mb-3">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Recents</p>
            {recents.map((s) => (
              <button
                key={s.id}
                onClick={() => onSongClick(s)}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-text hover:bg-card-hover transition-colors truncate"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        <div className="mx-3 my-1 border-t border-border" />

        {/* Crates */}
        <div className="px-2 mt-2">
          <div className="flex items-center justify-between px-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Crates</p>
            <button
              onClick={() => startAdding("")}
              className="text-muted hover:text-accent transition-colors"
              aria-label="New crate"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Collection root */}
          <button
            onClick={() => { toggleFolder("__collection__"); onFolderDoubleClick("all"); }}
            onDragOver={(e) => handleDragOver(e, "Collection")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "Collection")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              isCollectionActive
                ? "bg-accent-muted text-accent border-l-[3px] border-accent pl-2.5"
                : dragOverFolder === "Collection"
                ? "bg-accent-muted border-l-[3px] border-accent pl-2.5"
                : "text-text hover:bg-card-hover"
            }`}
          >
            {isCollectionExpanded ? <ChevronDown size={12} className="shrink-0 text-muted" /> : <ChevronRight size={12} className="shrink-0 text-muted" />}
            <FolderOpen size={14} className="shrink-0 text-muted" />
            <span className="truncate flex-1 text-left font-medium">Collection</span>
            <span className="text-[10px] text-muted shrink-0">{songs.length}</span>
          </button>

          {isCollectionExpanded && (
            <div className="ml-3 border-l border-border pl-1 mb-1 mt-0.5">
              {/* Direct Collection songs */}
              {collectionSongs.map((s) => (
                <button
                  key={s.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("songId", String(s.id))}
                  onClick={() => onSongClick(s)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-muted hover:text-text hover:bg-card-hover transition-colors truncate cursor-grab active:cursor-grabbing"
                >
                  {s.title}
                </button>
              ))}

              {/* Top-level new crate input */}
              {addingUnder === "" && (
                <div className="mx-1 mb-1 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card-hover border border-accent/40">
                  <FolderOpen size={12} className="text-muted shrink-0" />
                  <input
                    ref={crateInputRef}
                    value={newCrateName}
                    onChange={(e) => setNewCrateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitNewCrate();
                      if (e.key === "Escape") { setAddingUnder(null); setNewCrateName(""); }
                    }}
                    onBlur={commitNewCrate}
                    placeholder="Subcrate name…"
                    className="flex-1 text-xs bg-transparent outline-none text-text placeholder:text-muted"
                  />
                </div>
              )}

              {/* Recursive tree */}
              {crateTree.map((node) => renderCrateNode(node, 0))}

              {crateTree.length === 0 && collectionSongs.length === 0 && addingUnder !== "" && (
                <p className="px-2 py-1.5 text-xs text-muted italic">Empty</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-border p-3 space-y-1">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:bg-card-hover transition-colors">
          <MessageSquare size={14} />
          Feedback
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">U</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">User</p>
            <p className="text-[10px] text-muted">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
