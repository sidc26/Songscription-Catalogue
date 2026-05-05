import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToSong } from "@/lib/db";
import { generateAISummary } from "@/lib/groq";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "Groq API key not configured" }, { status: 503 });
  }

  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as Record<string, unknown> | undefined;

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const song = rowToSong(row);
    const summary = await generateAISummary(song);

    db.prepare("UPDATE songs SET ai_summary = ? WHERE id = ?").run(JSON.stringify(summary), id);

    return NextResponse.json(summary);
  } catch (err: unknown) {
    console.error("AI summary error:", err);
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
