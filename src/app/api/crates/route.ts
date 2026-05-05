import { NextRequest, NextResponse } from "next/server";
import { getCrates, createCrateAndAncestors, deleteCrateAndDescendants } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getCrates());
}

const MAX_CRATE_DEPTH = 5;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const path = typeof body?.path === "string" ? body.path.trim() : "";
  if (!path || path === "Collection") {
    return NextResponse.json({ error: "Invalid crate path" }, { status: 400 });
  }
  if (path.split("/").length > MAX_CRATE_DEPTH) {
    return NextResponse.json({ error: `Crate path too deep (max ${MAX_CRATE_DEPTH} levels)` }, { status: 400 });
  }
  createCrateAndAncestors(path);
  return NextResponse.json({ path });
}

export async function DELETE(request: NextRequest) {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!path || path === "Collection") {
    return NextResponse.json({ error: "Invalid crate path" }, { status: 400 });
  }
  deleteCrateAndDescendants(path);
  return NextResponse.json({ ok: true });
}
