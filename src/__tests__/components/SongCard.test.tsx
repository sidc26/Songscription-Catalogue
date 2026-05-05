import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SongCard } from "@/components/SongCard";
import type { Song } from "@/types";

const baseSong: Song = {
  id: 1,
  filename: "abc.mid",
  original_name: "Bach.mid",
  title: "Bach Invention No. 1",
  artist: "Bach",
  instrument: "Piano",
  genre: "Classical",
  mood: "Peaceful",
  folder: "Collection",
  difficulty: "Intermediate",
  duration_sec: 90,
  tempo_bpm: 96,
  track_count: 1,
  note_count: 300,
  format: 1,
  ticks_per_qn: 480,
  instrument_names: [],
  key_signature: "C Major",
  time_signature: "4/4",
  transcription_type: "direct",
  tags: [],
  is_favorite: false,
  play_count: 0,
  last_played: null,
  share_count: 0,
  ai_summary: null,
  created_at: "2024-01-01T00:00:00Z",
};

const noop = () => {};

// ─── Grid view ───────────────────────────────────────────────────────────────

describe("SongCard (grid view)", () => {
  it("renders the song title", () => {
    render(<SongCard song={baseSong} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("Bach Invention No. 1")).toBeInTheDocument();
  });

  it("renders the artist name", () => {
    render(<SongCard song={baseSong} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("Bach")).toBeInTheDocument();
  });

  it("renders 'Unknown artist' when artist is empty", () => {
    render(<SongCard song={{ ...baseSong, artist: "" }} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("Unknown artist")).toBeInTheDocument();
  });

  it("renders duration formatted as m:ss", () => {
    render(<SongCard song={baseSong} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("renders key signature when set", () => {
    render(<SongCard song={baseSong} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("C Major")).toBeInTheDocument();
  });

  it("renders the mood-based color strip with correct background color", () => {
    const { container } = render(
      <SongCard song={{ ...baseSong, mood: "Energetic" }} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />
    );
    const strip = container.querySelector(".h-1\\.5");
    expect(strip).toHaveStyle({ backgroundColor: "#F97316" });
  });

  it("renders slate fallback color when no mood is set", () => {
    const { container } = render(
      <SongCard song={{ ...baseSong, mood: "" }} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />
    );
    const strip = container.querySelector(".h-1\\.5");
    expect(strip).toHaveStyle({ backgroundColor: "#94A3B8" });
  });

  it("calls onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(<SongCard song={baseSong} view="grid" onFavorite={noop} onClick={onClick} onDragStart={noop} />);
    fireEvent.click(screen.getByText("Bach Invention No. 1"));
    expect(onClick).toHaveBeenCalledWith(baseSong);
  });

  it("calls onFavorite with toggled value when heart is clicked", () => {
    const onFavorite = vi.fn();
    render(<SongCard song={baseSong} view="grid" onFavorite={onFavorite} onClick={noop} onDragStart={noop} />);
    // Find and click the heart button (aria — it's the only button without a label that's always visible)
    const buttons = screen.getAllByRole("button");
    const heartBtn = buttons.find((b) => b.querySelector("svg"));
    fireEvent.click(heartBtn!);
    expect(onFavorite).toHaveBeenCalledWith(1, true);
  });

  it("shows filled heart when song is favorited", () => {
    const { container } = render(
      <SongCard song={{ ...baseSong, is_favorite: true }} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} />
    );
    // The heart SVG should have fill="currentColor" when favorited
    const heartSvg = container.querySelector('[fill="currentColor"]');
    expect(heartSvg).toBeInTheDocument();
  });
});

// ─── List view ───────────────────────────────────────────────────────────────

describe("SongCard (list view)", () => {
  it("renders the song title in list view", () => {
    render(<SongCard song={baseSong} view="list" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("Bach Invention No. 1")).toBeInTheDocument();
  });

  it("renders tempo in list view", () => {
    render(<SongCard song={baseSong} view="list" onFavorite={noop} onClick={noop} onDragStart={noop} />);
    expect(screen.getByText("96 bpm")).toBeInTheDocument();
  });

  it("renders the mood-based color bar in list view", () => {
    const { container } = render(
      <SongCard song={{ ...baseSong, mood: "Intense" }} view="list" onFavorite={noop} onClick={noop} onDragStart={noop} />
    );
    const bar = container.querySelector(".w-1");
    expect(bar).toHaveStyle({ backgroundColor: "#EF4444" });
  });
});

// ─── Delete confirmation ──────────────────────────────────────────────────────

describe("SongCard delete flow", () => {
  it("requires a second click to confirm deletion", () => {
    const onDelete = vi.fn();
    render(<SongCard song={baseSong} view="grid" onFavorite={noop} onClick={noop} onDragStart={noop} onDelete={onDelete} />);

    // Hover to reveal trash button
    const card = screen.getByText("Bach Invention No. 1").closest("div[draggable]")!;
    fireEvent.mouseOver(card);

    const trashBtn = screen.getByTitle("Delete");
    fireEvent.click(trashBtn);
    expect(onDelete).not.toHaveBeenCalled(); // first click = confirming state

    fireEvent.click(trashBtn);
    expect(onDelete).toHaveBeenCalledWith(1); // second click = confirmed
  });
});
