import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { buildProfilePrompt } from "@/lib/stats";
import type { ProfileStats } from "@/lib/stats";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const { stats }: { stats: ProfileStats } = await request.json();

    // Stats are computed client-side and POSTed here rather than re-fetched from the
    // DB, avoiding a second songs query just to build the prompt.
    if (!stats || typeof stats.totalSongs !== "number") {
      return NextResponse.json({ error: "Invalid stats payload" }, { status: 400 });
    }

    const prompt = buildProfilePrompt(stats);

    // Higher temperature (0.9) than per-song summaries (0.7): personality blurbs
    // benefit from more creative variation since they're shown once per session.
    const completion = await getClient().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? "";

    // generated_at is returned so the client can display a "last generated" date
    // alongside the cached summary in localStorage without querying the server again.
    return NextResponse.json({ summary, generated_at: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
