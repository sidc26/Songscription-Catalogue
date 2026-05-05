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
          values.push(Array.isArray(body[key]) ? JSON.stringify(body[key]) : body[key]);
        } else if (key === "ai_summary") {
          values.push(body[key] !== null ? JSON.stringify(body[key]) : null);
        } else if (key === "is_favorite") {
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

    const filepath = path.join(process.cwd(), "public", "uploads", row.filename);
    try { fs.unlinkSync(filepath); } catch { /* ignore */ }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
