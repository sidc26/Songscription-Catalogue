import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToSong } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder");
    const sort = searchParams.get("sort") ?? "recent";

    // "recent" uses COALESCE so songs that have never been played sort by upload
    // date instead of being pushed to the bottom. All sort directions are fixed here
    // because the client-side SongGrid also applies its own sort — the DB sort only
    // determines the initial order on page load.
    const sortClause = {
      recent: "COALESCE(last_played, created_at) DESC",
      created_at: "created_at DESC",
      title: "title ASC",
      tempo_bpm: "tempo_bpm DESC",
      duration_sec: "duration_sec ASC",
    }[sort] ?? "COALESCE(last_played, created_at) DESC";

    let sql = `SELECT * FROM songs`;
    const params: string[] = [];

    if (folder && folder !== "all") {
      sql += ` WHERE folder = ?`;
      params.push(folder);
    }

    sql += ` ORDER BY ${sortClause}`;

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    return NextResponse.json(rows.map(rowToSong));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const stmt = db.prepare(`
      INSERT INTO songs (
        filename, original_name, title, artist, instrument, genre, mood,
        folder, difficulty, duration_sec, tempo_bpm, track_count, note_count,
        format, ticks_per_qn, instrument_names, key_signature, time_signature,
        transcription_type, tags
      ) VALUES (
        @filename, @original_name, @title, @artist, @instrument, @genre, @mood,
        @folder, @difficulty, @duration_sec, @tempo_bpm, @track_count, @note_count,
        @format, @ticks_per_qn, @instrument_names, @key_signature, @time_signature,
        @transcription_type, @tags
      )
    `);

    const result = stmt.run({
      filename: body.filename,
      original_name: body.original_name,
      title: body.title || body.original_name,
      artist: body.artist || "",
      instrument: body.instrument || "",
      genre: body.genre || "",
      mood: body.mood || "",
      folder: body.folder || "Collection",
      difficulty: body.difficulty || "",
      duration_sec: body.midi?.duration_sec ?? 0,
      tempo_bpm: body.midi?.tempo_bpm ?? 120,
      track_count: body.midi?.track_count ?? 1,
      note_count: body.midi?.note_count ?? 0,
      format: body.midi?.format ?? 1,
      ticks_per_qn: body.midi?.ticks_per_qn ?? 480,
      instrument_names: JSON.stringify(body.midi?.instrument_names ?? []),
      key_signature: body.key_signature || "",
      time_signature: body.time_signature || "",
      transcription_type: body.transcription_type || "direct",
      // POST receives tags as a raw comma-separated string from the wizard form.
      // PATCH receives tags as a pre-split array. This asymmetry is intentional:
      // the wizard sends unprocessed textarea input; PATCH sends structured data.
      tags: JSON.stringify(
        (body.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean)
      ),
    });

    const created = db.prepare("SELECT * FROM songs WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
    return NextResponse.json(rowToSong(created), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
