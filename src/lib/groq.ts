import Groq from "groq-sdk";
import type { AISummary, Song } from "@/types";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

export async function generateAISummary(song: Song): Promise<AISummary> {
  const prompt = `You are an expert music teacher and music historian with deep knowledge of music theory, transcription, and pedagogy. A student has transcribed the following piece:

Title: ${song.title || song.original_name}
Artist/Composer: ${song.artist || "Unknown"}
Tempo: ${Math.round(song.tempo_bpm)} BPM
Key: ${song.key_signature || "Unknown"}
Time Signature: ${song.time_signature || "Unknown"}
Instrument: ${song.instrument || "Unknown"}
Genre: ${song.genre || "Unknown"}
Duration: ${Math.floor(song.duration_sec / 60)}m ${Math.floor(song.duration_sec % 60)}s
Tracks: ${song.track_count}, Notes: ${song.note_count}

Respond with ONLY valid JSON (no markdown, no code blocks) in this exact structure:
{
  "facts": ["fact1", "fact2", "fact3"],
  "tips": ["tip1", "tip2", "tip3"],
  "related": [
    {"title": "Song Name", "artist": "Artist Name", "reason": "One sentence why this pairs well"},
    {"title": "Song Name", "artist": "Artist Name", "reason": "One sentence why this pairs well"},
    {"title": "Song Name", "artist": "Artist Name", "reason": "One sentence why this pairs well"}
  ]
}

facts: 3 essential or interesting facts about this piece, its history, or its musical significance.
tips: 3 specific, actionable practice recommendations — e.g. playing the main theme through all 12 keys, studying a particular chord progression, common mistakes players make, or a specific quality to focus on when performing.
related: 3 related songs or pieces genuinely worth transcribing or studying alongside this one (like Billie's Bounce → Blues for Alice), each with a concise reason why they complement each other musically.`;

  const completion = await getClient().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(text) as AISummary;

  if (!parsed.facts || !parsed.tips || !parsed.related) {
    throw new Error("Invalid AI response structure");
  }

  return parsed;
}
