import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import type { Song, AISummary } from "@/types";

declare global {
  var __db: DatabaseSync | undefined;
}

function initDb(): DatabaseSync {
  const dataDir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dataDir, { recursive: true });

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, "songs.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS crates (
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
      folder             TEXT    NOT NULL DEFAULT 'Collection',
      difficulty         TEXT    NOT NULL DEFAULT '',
      duration_sec       REAL    NOT NULL DEFAULT 0,
      tempo_bpm          REAL    NOT NULL DEFAULT 120,
      track_count        INTEGER NOT NULL DEFAULT 1,
      note_count         INTEGER NOT NULL DEFAULT 0,
      format             INTEGER NOT NULL DEFAULT 1,
      ticks_per_qn       INTEGER NOT NULL DEFAULT 480,
      instrument_names   TEXT    NOT NULL DEFAULT '[]',
      key_signature      TEXT    NOT NULL DEFAULT '',
      time_signature     TEXT    NOT NULL DEFAULT '',
      transcription_type TEXT    NOT NULL DEFAULT 'direct',
      tags               TEXT    NOT NULL DEFAULT '[]',
      is_favorite        INTEGER NOT NULL DEFAULT 0,
      play_count         INTEGER NOT NULL DEFAULT 0,
      last_played        TEXT,
      share_count        INTEGER NOT NULL DEFAULT 0,
      ai_summary         TEXT,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_songs_last_played ON songs(last_played DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_created     ON songs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_favorite    ON songs(is_favorite DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_folder      ON songs(folder);
    CREATE INDEX IF NOT EXISTS idx_songs_title       ON songs(title);
  `);

  // Seed crates from existing song folders (runs once; OR IGNORE makes it idempotent)
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

export function createCrateAndAncestors(path: string): void {
  const stmt = getDb().prepare("INSERT OR IGNORE INTO crates (path) VALUES (?)");
  const parts = path.split("/").filter(Boolean);
  let built = "";
  for (const p of parts) {
    built = built ? `${built}/${p}` : p;
    stmt.run(built);
  }
}

export function deleteCrateAndDescendants(path: string): void {
  getDb().prepare("DELETE FROM crates WHERE path = ? OR path LIKE ?").run(path, `${path}/%`);
}

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
    is_favorite: (row.is_favorite as number) === 1,
    play_count: row.play_count as number,
    last_played: row.last_played as string | null,
    share_count: row.share_count as number,
    ai_summary: safeJsonParse<AISummary>(row.ai_summary as string, null as unknown as AISummary),
    created_at: row.created_at as string,
  };
}

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}
