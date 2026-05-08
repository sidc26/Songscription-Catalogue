# Songscription

A personal MIDI transcription catalogue. Upload MIDI files, annotate them with rich metadata, organise into nested crates, and play them back in the browser — with an AI music teacher built in.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Open .env.local and add your Groq API key (https://console.groq.com)

# 3. Start the dev server
npm run dev
# Open http://localhost:3000
```

The SQLite database is created automatically at `.data/songs.db` on first run. No migrations or extra setup needed.

---

## Design

Architecture decisions, component structure, and the rationale behind key product choices are documented in [DESIGN.md](DESIGN.md). Database schema and API reference are in [SCHEMA.md](SCHEMA.md).

---

## Features

### Upload & Validation
- Drag-and-drop or click-to-upload MIDI files (`.mid`, `.midi`)
- Security validation: magic bytes check (`MThd`) rejects non-MIDI files before writing to disk; full structural parse catches corrupted files after
- 10 MB size limit; files under 14 bytes rejected immediately

### 5-Step Upload Wizard
1. **Upload** — drop your MIDI file
2. **Trim** — drag start/end handles to select the section to transcribe (mouse + touch supported)
3. **Tag** — title, artist, instrument, genre, mood, key signature, time signature, difficulty, crate, tags
4. **Transcription Type** — direct transcription or arrangement
5. **Copyright** — rights acknowledgement before saving

### Rich Metadata
All fields are editable after upload in the song detail panel:
- Title, artist, target instrument
- Genre (Classical, Jazz, Pop, Rock, Electronic, R&B, Folk, Hip-Hop, Other)
- Mood (Energetic, Melancholic, Peaceful, Intense, Playful, Romantic, Mysterious, Triumphant)
- Key signature (all 24 major/minor keys)
- Time signature (4/4, 3/4, 6/8, 2/4, 5/4, 7/8, 12/8)
- Difficulty (Beginner, Intermediate, Advanced, Expert)
- Tags (comma-separated, fuzzy-searchable)
- Crate assignment (supports full nested path e.g. `Jazz/Bebop`)
- MIDI-derived: duration, tempo, track count, note count, format, ticks/quarter note, instrument names

### AI Music Teacher
- Powered by Groq (`llama-3.3-70b-versatile`)
- Generates: 3 interesting facts about the piece, 3 specific practice tips, and 3 related pieces worth studying alongside it
- Cached in the database after first generation; free to regenerate

### Browser MIDI Playback
- Built on the Web Audio API — no third-party bundling issues
- Triangle-wave oscillators with velocity-scaled gain envelopes
- Controls: play/pause, scrubber, speed (0.25× – 2×), loop
- Trim region respected during playback in the wizard

### Nested Crates
- Up to 5 levels deep (e.g. `Jazz/Bebop/Modal`) — validated server-side
- Persisted in SQLite — empty crates survive page refresh
- Ancestors auto-created (creating `Jazz/Bebop` also creates `Jazz`)
- Inline creation at any level (hover a crate → click `+`)
- Deleting a crate moves all songs (including any sub-crate contents) to Collection
- Drag songs from the grid or sidebar into any sidebar crate

### Search, Filter & Sort
- Fuzzy search (Fuse.js) across title, artist, genre, mood, key, tags
- Filter by genre, mood, difficulty (multi-select, scrollable)
- Sort by: recently accessed, date added, title A–Z, artist A–Z, duration, tempo
- Grid and list view (preference persisted in localStorage)

### Song Detail Panel
- Edit all metadata inline; changes saved on blur/select
- Incomplete fields banner (amber, per-song dismissible)
- Share: free, unlimited (viral growth driver)
- PDF export: gated (Pro) — a clean PDF download can permanently replace the platform for some users, so it's the right paywall point
- MIDI download: intentionally removed — users uploaded it themselves
- Practice CTA with piano roll placeholder (interactive practice mode coming in a future release)
- Delete with confirmation dialog

### Favorites
- Heart any song from the card, list view, or detail panel
- Dedicated Favorites screen filters the library to hearted songs only

### Songscripter Profile
- Streak tracking (current + longest), total duration, notes transcribed, time saved, average tempo, top genre and mood
- Mood and difficulty distribution charts
- AI-generated "transcriber identity" card (Groq, cached in `localStorage`)
- Shareable profile link — encodes stats as a Base64 URL param, no server storage needed

### Sidebar
- Collapsible to icon-only mode
- Recent songs (last 3 accessed)
- Full nested crate tree with song counts
- Songs in the sidebar are draggable onto crates

---

## Supported Flows

1. **Upload a new transcription** — drag a `.mid` onto the landing card or click "New Transcription"
2. **Trim and tag** — use the wizard to select a region and annotate with metadata
3. **Browse library** — click "Transcriptions" in the sidebar; switch between grid and list view
4. **Search** — click "Search" or type in the toolbar search box; fuzzy matches across all fields
5. **Filter and sort** — use the Filter and Sort dropdowns in the toolbar
6. **Open a song** — click any card or sidebar song item to open the detail panel
7. **Edit metadata** — edit fields inline; changes persist automatically
8. **Get AI analysis** — click "Generate" in the AI Summary section of the detail panel
9. **Share** — click the share icon in the detail panel (free, unlimited)
10. **Create a crate** — click `+` next to "Crates" in the sidebar, or hover any crate and click its `+` to nest inside it
11. **Organise** — drag cards from the grid or songs from the sidebar onto sidebar crates
12. **Filter by crate** — click a crate in the sidebar; breadcrumb shows the full path with clickable ancestors
13. **Delete a crate** — hover crate → trash icon → confirm; all songs move to Collection
14. **Delete a song** — click trash icon on card (confirm on second click) or use the delete button in the detail panel
15. **View favorites** — click the Heart icon in the sidebar to filter the library to hearted songs
16. **View your profile** — click "My Profile" in the sidebar; share it via the Share button to copy a link

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Database | SQLite via `node:sqlite` (`DatabaseSync`) |
| MIDI parsing | `@tonejs/midi` (server-side only) |
| MIDI playback | Web Audio API (client-side, no bundler issues) |
| Search | Fuse.js (client-side fuzzy matching) |
| AI | Groq (`llama-3.3-70b-versatile`) |
| Upload validation | Magic bytes (`MThd`) + structural parse |

---

## Notes

**Backend choice:** I used Node.js's built-in `node:sqlite` module with `DatabaseSync` rather than Prisma, Drizzle, or an external service. The take-home runs in a fresh environment — a native addon or a hosted database would add setup friction. `node:sqlite` is built into Node 22+, needs zero configuration, and is synchronous, which suits a single-user local app perfectly: no async ceremony for straightforward reads and writes, and no connection pool to manage.

**One thing I'd do differently with more time:** The "time saved" estimate currently uses a flat 5× multiplier on total duration (a reasonable baseline — manual transcription typically takes 4–6× playback time). I'd replace it with a per-piece model that weights by difficulty, note density (`note_count / duration_sec`), and genre. That makes the number genuinely meaningful rather than a rough approximation, and it turns the stat into something a user would actually feel reflects their effort.

**One thing I'm proud of:** The crate system. Storing hierarchy as slash-separated paths in a single `TEXT` column (`Jazz/Bebop`) looks like a simplification, but it makes the two most common operations — filtering songs by crate and displaying the tree — each a single database query. The tree is reconstructed client-side from the flat path set, ancestor creation is a single `INSERT OR IGNORE` loop, and subtree deletion is one `LIKE 'Jazz/%'` statement. The schema stays minimal without sacrificing any of the nesting flexibility a real library needs.
