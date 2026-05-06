// node:sqlite DatabaseSync ships with Node 22+ and requires no native compilation,
// making it safe to use in serverless/edge-adjacent deployments without build tooling.
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import type { Song, AISummary } from "@/types";

// Stored on globalThis so Next.js hot-reloads don't open a second connection.
// Without this guard, each HMR cycle would create a new DatabaseSync instance
// while the old one (and its WAL lock) is still alive.
declare global {
  var __db: DatabaseSync | undefined;
}

function initDb(): DatabaseSync {
  const dataDir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dataDir, { recursive: true });

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, "songs.db"));
  // WAL mode allows concurrent reads alongside a write, which matters when the
  // dev server and a route handler race. Critically, WAL also survives crashes
  // better than the default DELETE journal.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS crates (
      -- Entire hierarchy stored as a single slash-separated TEXT path (e.g. "Jazz/Bebop").
      -- Tree reconstruction happens client-side; the DB only stores leaf nodes and
      -- intermediate paths that were explicitly created.
      path TEXT PRIMARY KEY
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      filename           TEXT    NOT NULL,
      original_name      TEXT    NOT NULL,
      title              TEXT    NOT NULL,
      artist             TEXT    NOT NULL DEFAULT '',
      instrument         TEXT    NOT NULL DEFAULT '',
      genre              TEXT    NOT NULL DEFAULT '',
      mood               TEXT    NOT NULL DEFAULT '',
      -- folder references a crate path by convention, NOT by FK.
      -- Intentional: deleting a crate must not cascade-delete its songs;
      -- they fall back to 'Collection' instead (handled in handleDeleteCrate).
      folder             TEXT    NOT NULL DEFAULT 'Collection',
      difficulty         TEXT    NOT NULL DEFAULT '',
      duration_sec       REAL    NOT NULL DEFAULT 0,
      tempo_bpm          REAL    NOT NULL DEFAULT 120,
      track_count        INTEGER NOT NULL DEFAULT 1,
      note_count         INTEGER NOT NULL DEFAULT 0,
      format             INTEGER NOT NULL DEFAULT 1,
      ticks_per_qn       INTEGER NOT NULL DEFAULT 480,
      -- instrument_names and tags are JSON arrays serialised into TEXT columns.
      -- SQLite JSON functions aren't used here; parsing happens in rowToSong.
      instrument_names   TEXT    NOT NULL DEFAULT '[]',
      key_signature      TEXT    NOT NULL DEFAULT '',
      time_signature     TEXT    NOT NULL DEFAULT '',
      transcription_type TEXT    NOT NULL DEFAULT 'direct',
      tags               TEXT    NOT NULL DEFAULT '[]',
      -- SQLite has no BOOLEAN type; 0/1 INTEGER is the idiomatic substitute.
      -- Coercion to boolean happens in rowToSong, so callers never see raw integers.
      is_favorite        INTEGER NOT NULL DEFAULT 0,
      play_count         INTEGER NOT NULL DEFAULT 0,
      last_played        TEXT,
      share_count        INTEGER NOT NULL DEFAULT 0,
      -- ai_summary is cached here after first generation so subsequent opens skip
      -- the Groq round-trip. NULL means not yet generated; once set it persists forever
      -- (no TTL) to avoid re-billing users on every detail panel open.
      ai_summary         TEXT,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_songs_last_played ON songs(last_played DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_created     ON songs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_favorite    ON songs(is_favorite DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_folder      ON songs(folder);
    CREATE INDEX IF NOT EXISTS idx_songs_title       ON songs(title);
  `);

  // Back-fill crates for any songs that were imported before the crates table existed.
  // OR IGNORE means re-running on startup is safe even if crates already exist.
  const existingFolders = db
    .prepare("SELECT DISTINCT folder FROM songs WHERE folder != 'Collection'")
    .all() as { folder: string }[];
  const insertCrate = db.prepare("INSERT OR IGNORE INTO crates (path) VALUES (?)");
  for (const { folder } of existingFolders) {
    const parts = folder.split("/").filter(Boolean);
    let built = "";
    for (const p of parts) {
      built = built ? `${built}/${p}` : p;
      insertCrate.run(built);
    }
  }

  cleanupOrphans(db, uploadsDir);

  return db;
}

export function getCrates(): string[] {
  return (getDb().prepare("SELECT path FROM crates ORDER BY path").all() as { path: string }[]).map((r) => r.path);
}

// Inserts the full path AND every ancestor so tree rendering never has orphan nodes.
// e.g. "Jazz/Bebop/Hard" also inserts "Jazz" and "Jazz/Bebop" if missing.
export function createCrateAndAncestors(path: string): void {
  const stmt = getDb().prepare("INSERT OR IGNORE INTO crates (path) VALUES (?)");
  const parts = path.split("/").filter(Boolean);
  let built = "";
  for (const p of parts) {
    built = built ? `${built}/${p}` : p;
    stmt.run(built);
  }
}

// LIKE prefix match removes the crate and every child path in one query.
// Songs in these crates are NOT deleted here; callers must patch them to 'Collection' first.
export function deleteCrateAndDescendants(path: string): void {
  getDb().prepare("DELETE FROM crates WHERE path = ? OR path LIKE ?").run(path, `${path}/%`);
}

// Deletes MIDI files in /public/uploads that have no corresponding DB row.
// Orphans accumulate when a server crash interrupts the upload→INSERT sequence,
// or when files are manually removed from the DB. Runs once at startup.
function cleanupOrphans(db: DatabaseSync, uploadsDir: string): void {
  try {
    const files = fs.readdirSync(uploadsDir);
    const rows = db.prepare("SELECT filename FROM songs").all() as { filename: string }[];
    const known = new Set(rows.map((r) => r.filename));
    files.forEach((f) => {
      if (!known.has(f)) {
        try { fs.unlinkSync(path.join(uploadsDir, f)); } catch { /* ignore */ }
      }
    });
  } catch { /* ignore */ }
}

export function getDb(): DatabaseSync {
  if (!global.__db) {
    global.__db = initDb();
  }
  return global.__db;
}

// Converts a raw SQLite row (all values are primitives) into the typed Song shape.
// This is the single place that handles TEXT→boolean and TEXT→array coercions
// so callers never need to think about storage representation.
export function rowToSong(row: Record<string, unknown>): Song {
  return {
    id: row.id as number,
    filename: row.filename as string,
    original_name: row.original_name as string,
    title: row.title as string,
    artist: row.artist as string,
    instrument: row.instrument as string,
    genre: row.genre as string,
    mood: row.mood as string,
    folder: row.folder as string,
    difficulty: row.difficulty as string,
    duration_sec: row.duration_sec as number,
    tempo_bpm: row.tempo_bpm as number,
    track_count: row.track_count as number,
    note_count: row.note_count as number,
    format: row.format as number,
    ticks_per_qn: row.ticks_per_qn as number,
    instrument_names: safeJsonParse<string[]>(row.instrument_names as string, []),
    key_signature: row.key_signature as string,
    time_signature: row.time_signature as string,
    transcription_type: (row.transcription_type as string) as "direct" | "arrangement",
    tags: safeJsonParse<string[]>(row.tags as string, []),
    // Strict equality to 1 (not just truthy) because SQLite returns 0 or 1.
    is_favorite: (row.is_favorite as number) === 1,
    play_count: row.play_count as number,
    last_played: row.last_played as string | null,
    share_count: row.share_count as number,
    ai_summary: safeJsonParse<AISummary>(row.ai_summary as string, null as unknown as AISummary),
    created_at: row.created_at as string,
  };
}

// Returns the fallback rather than throwing when a column contains malformed JSON,
// e.g. from a direct DB edit or a failed mid-write. Empty string also returns fallback.
function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}
