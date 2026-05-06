import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToSong } from "@/lib/db";
import { generateAISummary } from "@/lib/groq";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  // Fail fast with 503 so the client can show a "configure your API key" message
  // rather than waiting for a Groq auth error response.
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

    // Persist immediately so subsequent panel opens skip the Groq call entirely.
    // The client also updates its local state via the PATCH in AISummary.tsx.
    db.prepare("UPDATE songs SET ai_summary = ? WHERE id = ?").run(JSON.stringify(summary), id);

    return NextResponse.json(summary);
  } catch (err: unknown) {
    console.error("AI summary error:", err);
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
