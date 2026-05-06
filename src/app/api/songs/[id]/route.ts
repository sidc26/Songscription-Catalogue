import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToSong } from "@/lib/db";
import fs from "fs";
import path from "path";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToSong(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    // Allowlist prevents arbitrary column injection — only user-editable fields
    // are accepted. MIDI metadata fields (note_count, duration_sec, etc.) are
    // intentionally excluded; they're immutable after upload.
    const allowed = [
      "title", "artist", "key_signature", "time_signature", "tags", "is_favorite",
      "genre", "mood", "difficulty", "folder", "play_count", "last_played",
      "share_count", "transcription_type", "instrument", "ai_summary",
    ];

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        if (key === "tags") {
          // PATCH always receives tags as a JS array; serialise to TEXT for storage.
          values.push(Array.isArray(body[key]) ? JSON.stringify(body[key]) : body[key]);
        } else if (key === "ai_summary") {
          // Allow explicit null to clear a cached summary (e.g. after song metadata edit).
          values.push(body[key] !== null ? JSON.stringify(body[key]) : null);
        } else if (key === "is_favorite") {
          // Coerce boolean to 0/1 because SQLite has no native BOOLEAN column type.
          values.push(body[key] ? 1 : 0);
        } else {
          values.push(body[key]);
        }
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE songs SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const updated = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as Record<string, unknown>;
    return NextResponse.json(rowToSong(updated));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare("SELECT filename FROM songs WHERE id = ?").get(id) as { filename: string } | undefined;

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    db.prepare("DELETE FROM songs WHERE id = ?").run(id);

    // Delete the MIDI file after the DB row is gone; losing the file without the
    // row would be an orphan (caught by cleanupOrphans), but losing the row without
    // the file would break the player for anyone who has the URL cached.
    const filepath = path.join(process.cwd(), "public", "uploads", row.filename);
    try { fs.unlinkSync(filepath); } catch { /* ignore */ }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
