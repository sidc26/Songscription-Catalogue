// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSong = {
  id: 1, filename: "abc.mid", original_name: "Bach.mid", title: "Bach Invention",
  artist: "Bach", instrument: "Piano", genre: "Classical", mood: "Peaceful",
  folder: "Collection", difficulty: "Intermediate", duration_sec: 120, tempo_bpm: 96,
  track_count: 1, note_count: 300, format: 1, ticks_per_qn: 480,
  instrument_names: [], key_signature: "C Major", time_signature: "4/4",
  transcription_type: "direct" as const, tags: [], is_favorite: false,
  play_count: 0, last_played: null, share_count: 0, ai_summary: null,
  created_at: "2024-01-01T00:00:00Z",
};

const mockPrepare = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    prepare: mockPrepare,
  })),
  rowToSong: vi.fn((row: Record<string, unknown>) => ({ ...mockSong, ...row })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: prepare returns a statement that returns the mockSong
  mockPrepare.mockReturnValue({ get: mockGet, all: mockAll, run: mockRun });
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue({ ...mockSong });
  mockRun.mockReturnValue({ lastInsertRowid: 1 });
});

// ─── GET /api/songs ──────────────────────────────────────────────────────────

describe("GET /api/songs", () => {
  it("returns all songs with 200", async () => {
    const { GET } = await import("@/app/api/songs/route");
    mockAll.mockReturnValue([{ ...mockSong, is_favorite: 0 }]);
    const req = new Request("http://localhost/api/songs");
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ─── POST /api/songs ─────────────────────────────────────────────────────────

describe("POST /api/songs", () => {
  it("creates a song and returns 201", async () => {
    const { POST } = await import("@/app/api/songs/route");
    const req = new Request("http://localhost/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "abc.mid",
        original_name: "Bach.mid",
        title: "Bach Invention",
        artist: "Bach",
        genre: "Classical",
        mood: "Peaceful",
        folder: "Collection",
        midi: { duration_sec: 120, tempo_bpm: 96, track_count: 1, note_count: 300, format: 1, ticks_per_qn: 480, instrument_names: [] },
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});

// ─── GET /api/songs/[id] ─────────────────────────────────────────────────────

describe("GET /api/songs/[id]", () => {
  it("returns the song when found", async () => {
    const { GET } = await import("@/app/api/songs/[id]/route");
    mockGet.mockReturnValue({ ...mockSong, is_favorite: 0 });
    const req = new Request("http://localhost/api/songs/1");
    const res = await GET(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 404 when song is not found", async () => {
    const { GET } = await import("@/app/api/songs/[id]/route");
    mockGet.mockReturnValue(undefined);
    const req = new Request("http://localhost/api/songs/999");
    const res = await GET(req as any, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/songs/[id] ───────────────────────────────────────────────────

describe("PATCH /api/songs/[id]", () => {
  it("updates allowed fields and returns the song", async () => {
    const { PATCH } = await import("@/app/api/songs/[id]/route");
    mockGet.mockReturnValue({ ...mockSong, title: "Updated Title", is_favorite: 0 });
    const req = new Request("http://localhost/api/songs/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 400 when body contains no valid fields", async () => {
    const { PATCH } = await import("@/app/api/songs/[id]/route");
    const req = new Request("http://localhost/api/songs/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonexistentField: "value" }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);
  });

  it("converts is_favorite boolean to 0/1 for the DB", async () => {
    const { PATCH } = await import("@/app/api/songs/[id]/route");
    mockGet.mockReturnValue({ ...mockSong, is_favorite: 1 });
    const req = new Request("http://localhost/api/songs/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: true }),
    });
    await PATCH(req as any, { params: Promise.resolve({ id: "1" }) });
    // Verify run was called (the mock db processed it)
    expect(mockRun).toHaveBeenCalled();
  });
});

// ─── DELETE /api/songs/[id] ──────────────────────────────────────────────────

describe("DELETE /api/songs/[id]", () => {
  it("returns ok:true when song exists", async () => {
    const { DELETE } = await import("@/app/api/songs/[id]/route");
    mockGet.mockReturnValue({ filename: "abc.mid" });
    const req = new Request("http://localhost/api/songs/1");
    const res = await DELETE(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 when song does not exist", async () => {
    const { DELETE } = await import("@/app/api/songs/[id]/route");
    mockGet.mockReturnValue(undefined);
    const req = new Request("http://localhost/api/songs/999");
    const res = await DELETE(req as any, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });
});
