import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { parseMidi } from "@/lib/midi-parser";

// MIDI file magic bytes: all valid MIDI files start with "MThd" (0x4D546864)
const MIDI_MAGIC = Buffer.from([0x4d, 0x54, 0x68, 0x64]);

function isMidiMagicValid(buf: Buffer): boolean {
  if (buf.length < 14) return false; // MThd header is 14 bytes minimum
  return buf.slice(0, 4).equals(MIDI_MAGIC);
}

export async function POST(request: NextRequest) {
  let savedPath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Extension check
    const name = file.name.toLowerCase();
    if (!name.endsWith(".mid") && !name.endsWith(".midi")) {
      return NextResponse.json({ error: "Only .mid and .midi files are supported" }, { status: 400 });
    }

    // Size guard (10 MB — real MIDI files are almost never larger)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }

    if (file.size < 14) {
      return NextResponse.json({ error: "File is too small to be a valid MIDI file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic-bytes validation — rejects renamed non-MIDI files and truncated uploads
    if (!isMidiMagicValid(buffer)) {
      return NextResponse.json(
        { error: "File does not appear to be a valid MIDI file (magic bytes mismatch)" },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `${randomUUID()}.mid`;
    savedPath = path.join(uploadsDir, filename);
    await writeFile(savedPath, buffer);

    // Full structural parse — catches corrupted chunks, malformed headers, etc.
    let midi;
    try {
      midi = parseMidi(buffer);
    } catch (parseErr: unknown) {
      // Delete the saved file so it doesn't linger
      if (savedPath) await unlink(savedPath).catch(() => {});
      const detail = parseErr instanceof Error ? parseErr.message : "corrupted or unsupported file";
      return NextResponse.json(
        { error: `MIDI parsing failed: ${detail}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ filename, original_name: file.name, midi });
  } catch (err: unknown) {
    // Clean up on unexpected error
    if (savedPath) await unlink(savedPath).catch(() => {});
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
