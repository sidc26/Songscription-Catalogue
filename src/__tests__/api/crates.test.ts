// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the route handlers
vi.mock("@/lib/db", () => ({
  getCrates: vi.fn(),
  createCrateAndAncestors: vi.fn(),
  deleteCrateAndDescendants: vi.fn(),
}));

import * as db from "@/lib/db";
import { GET, POST, DELETE } from "@/app/api/crates/route";

const mockGetCrates = vi.mocked(db.getCrates);
const mockCreate = vi.mocked(db.createCrateAndAncestors);
const mockDelete = vi.mocked(db.deleteCrateAndDescendants);

beforeEach(() => vi.clearAllMocks());

// ─── GET /api/crates ─────────────────────────────────────────────────────────

describe("GET /api/crates", () => {
  it("returns sorted crate list", async () => {
    mockGetCrates.mockReturnValue(["Classical", "Jazz", "Jazz/Bebop"]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(["Classical", "Jazz", "Jazz/Bebop"]);
  });

  it("returns empty array when no crates exist", async () => {
    mockGetCrates.mockReturnValue([]);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });
});

// ─── POST /api/crates ────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/crates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/crates", () => {
  it("creates a crate and returns it", async () => {
    const req = makePostRequest({ path: "Jazz/Bebop" });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ path: "Jazz/Bebop" });
    expect(mockCreate).toHaveBeenCalledWith("Jazz/Bebop");
  });

  it("trims whitespace from the path", async () => {
    const req = makePostRequest({ path: "  Jazz  " });
    await POST(req as any);
    expect(mockCreate).toHaveBeenCalledWith("Jazz");
  });

  it("rejects empty path with 400", async () => {
    const req = makePostRequest({ path: "" });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects 'Collection' with 400", async () => {
    const req = makePostRequest({ path: "Collection" });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("rejects missing path with 400", async () => {
    const req = makePostRequest({});
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/crates ──────────────────────────────────────────────────────

function makeDeleteRequest(path: string) {
  return new Request(`http://localhost/api/crates?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

describe("DELETE /api/crates", () => {
  it("deletes a crate and returns ok", async () => {
    const req = makeDeleteRequest("Jazz");
    const res = await DELETE(req as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledWith("Jazz");
  });

  it("rejects empty path with 400", async () => {
    const req = makeDeleteRequest("");
    const res = await DELETE(req as any);
    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects 'Collection' with 400", async () => {
    const req = makeDeleteRequest("Collection");
    const res = await DELETE(req as any);
    expect(res.status).toBe(400);
  });
});
