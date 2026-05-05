# Design Document

## Architecture Overview

Songscription uses the Next.js 15 App Router with a clear server/client boundary:

- **Server components** (`app/page.tsx`) fetch initial data directly from SQLite and render the shell. No client-side fetch on first load.
- **Client components** (`CataloguePage`, `Sidebar`, `SongGrid`, `SongDetail`, wizard steps) own all interactive state and sync changes back to the API layer.
- **API routes** (`app/api/`) act as a thin REST layer over the database — no ORM, no query builder, just `DatabaseSync` prepared statements.

```
Browser
  └─ CataloguePage (owns: songs[], crates[], activeSong, activeFolder, activeNav)
       ├─ Sidebar          (reads: songs, crates — controlled)
       ├─ SongGrid         (reads: songs — controlled)
       ├─ SongDetail       (reads/writes: activeSong — controlled)
       └─ UploadWizard     (reads: crates — passes to Step3Tag)

Server (on request)
  └─ page.tsx → getDb() → songs + crates → CataloguePage (initialSongs, initialCrates)
```

`CataloguePage` is the single source of truth for client state. All child components are controlled — they receive data as props and emit changes via callbacks. This means there is exactly one place to update `songs` state, one place to update `crates` state, and optimistic updates are trivial to reason about.

---

## Key Design Decisions

### Web Audio API Instead of Tone.js

The original implementation used Tone.js for MIDI playback. This caused persistent failures:

1. Tone.js ships `"browser": "build/Tone.js"` in its `package.json`. Webpack (used by Next.js) resolves the `browser` field, so `import("tone")` at runtime gets the UMD bundle rather than the ESM build. Class constructors like `PolySynth` are inaccessible on the UMD namespace object.
2. The `Transport` named export is evaluated as `getContext().transport` at module parse time — before the browser's AudioContext is initialised — so it arrives as `undefined`.
3. These issues compounded across webpack's ESM→CJS transpilation boundary in ways that resisted every standard fix (`transpilePackages`, named imports, dynamic imports, `getTransport()`).

The final solution was to remove Tone.js entirely from the client and implement playback directly with the Web Audio API:
- `AudioContext` + `OscillatorNode` (triangle wave) + `GainNode` per note
- Scheduling via `ctx.currentTime` offsets
- Speed, seek, loop, and pause implemented through re-scheduling from an offset

This is fewer lines of code, zero bundler issues, and gives direct control over the audio graph.

### `node:sqlite` DatabaseSync Instead of an ORM

`node:sqlite` with `DatabaseSync` was chosen over Prisma, Drizzle, or `better-sqlite3` for one reason: **no native compilation**. The take-home runs in a fresh environment; a native addon would require build tools that may not be available. `node:sqlite` is built into Node.js 22+ and requires nothing extra. It is synchronous, which suits a single-user local app perfectly — no async/await ceremony for simple reads and writes.

### Flat Folder Strings With Slash-Paths

Crate hierarchy is encoded as slash-separated paths in a single `TEXT` column (`folder = "Jazz/Bebop"`), not as a recursive adjacency list or closure table. This keeps the schema simple and makes the most common operations (filter songs by crate, display songs in a crate) a single equality or LIKE query. The tree is reconstructed in the browser from the set of all paths — a fast client-side operation given the data volumes involved.

Paths are capped at 5 levels deep, validated server-side in the POST `/api/crates` handler. This prevents runaway nesting while still covering every practical use case.

The `crates` table stores paths independently of songs, so empty crates can exist. `createCrateAndAncestors` ensures that creating `Jazz/Bebop` also creates `Jazz` — the tree is always consistent without requiring explicit parent-child foreign keys.

### Crate Persistence Strategy

Crates are the only entity that needs to survive being empty. Songs solve their own persistence (they're in the DB). The solution:

1. `crates` table with `path TEXT PRIMARY KEY` — minimal schema.
2. On DB init, all distinct `folder` values from existing songs are seeded into `crates` (idempotent via `INSERT OR IGNORE`). This handles data created before the crates table existed.
3. `createCrateAndAncestors(path)` inserts the path and every ancestor segment in one go.
4. `deleteCrateAndDescendants(path)` uses `path LIKE 'Jazz/%'` to wipe the whole subtree in one statement.
5. `CataloguePage` owns `crates[]` state and syncs it optimistically — local state updates first, API call follows.

### Paywall Philosophy

Three download options were considered:

| Option | Decision | Reason |
|---|---|---|
| Share (link) | **Free, unlimited** | Virality: every share is a potential new user |
| PDF export | **Pro (gated)** | A clean PDF download can permanently replace the platform for a segment of users — the marginal cost of locking it is low, the revenue signal is strong |
| MIDI download | **Removed entirely** | The user uploaded their own file; offering it back adds no value and creates a confusing UI |

### Fuse.js Client-Side Search

Search runs entirely in the browser. The alternative — a server-side search endpoint — would add latency, require debouncing, and complicate the state model. At the data volumes a single-user catalogue reaches, Fuse.js over an in-memory array is faster than any round-trip. The `getFn` option handles array fields (tags) correctly: `{ name: "tags", getFn: (s) => s.tags.join(" ") }`.

### MIDI Upload Security

Two layers:

1. **Magic bytes** (`MThd` = `0x4D546864`): checked before writing to disk. Rejects renamed non-MIDI files instantly.
2. **Structural parse** (`parseMidi` from `@tonejs/midi`): run server-side after writing. Catches truncated files, malformed chunk headers, and unsupported MIDI variants. The saved file is deleted on parse failure.

`@tonejs/midi` is in `serverExternalPackages` so it is never bundled into the client build.

---

## Component Architecture

```
CataloguePage
  State: songs, crates, activeSong, detailOpen, wizardOpen, activeFolder, activeNav
  Handlers: handleCreateCrate, handleDeleteCrate, handleNewSong, handleDeleteSong,
            handleUpdate, handleDelete, handleFavorite, handleDrop,
            handleNavFavorites, handleNavStats

Sidebar (controlled)
  Props: songs, crates, activeFolder, activeNav
  Callbacks: onFolderClick, onFolderDoubleClick, onSongClick, onDrop,
             onCreateCrate, onDeleteCrate, onNavHome, onNavLibrary, onNavSearch,
             onNavFavorites, onNavStats
  Internal state: collapsed, expandedFolders, dragOverFolder, addingUnder, confirmDeleteCrate

SongGrid (controlled)
  Props: songs, loading, activeFolder, searchRef
  Internal state: query, sort, sortDir, filters, view (localStorage)
  Computed: filtered (Fuse.js + sort + filter pipeline)

SongDetail (controlled)
  Props: song, songs, crates, open
  Callbacks: onClose, onUpdate, onDelete, onCreateCrate
  Internal state: local edits, deleteConfirm, shareState, dismissedBannerId

ProfilePanel (controlled)
  Props: songs, onClose
  Computed: stats (computeStats), moodCounts
  Internal state: summary, summaryDate, loadingSummary, summaryError, copied, shareLoading
  Side effects: localStorage cache for AI summary; auto-fetch on mount if no cache

UploadWizard
  Props: open, initialStep, initialData, crates
  Internal state: step, data
  Steps: Step1Upload → Step2Trim → Step3Tag → Step4TranscriptionType → Step5Copyright
```

---

## Future Improvements

- **Stats and deleted transcriptions**: profile stats (`totalDurationSec`, `timeSavedSec`, `totalNotes`, streaks, etc.) are computed live from the current songs array. Deleting a transcription removes it from all stats immediately. This is the simplest correct behaviour, but it raises a genuine product question: if a user transcribed a piece and later deleted it from their library, did that work not happen? A future implementation could maintain a separate `transcription_events` ledger that persists aggregates (duration transcribed, notes written, streak days) independently of whether the song record still exists — similar to how a fitness app keeps a workout's calorie count even after you delete the workout from your log. The right answer depends on what the stat is meant to communicate: current library size, or cumulative effort.
- **Smarter time-saved estimate**: the profile currently estimates time saved as `total_duration_sec × 5` (a conservative baseline — manual transcription typically takes 4–6× playback time). A better algorithm would weight by difficulty rating, note density (`note_count / duration_sec`), and genre complexity, producing a per-piece estimate that aggregates more accurately. This is a key engagement metric worth investing in because it makes the value of each transcription tangible to the user.
- **Auto-tagging**: use a music analysis model (e.g. essentia, librosa) to infer key, tempo, mood, and genre from audio. The user-supplied tags in the current schema are the training signal for a future fine-tuned classifier.
- **Collaborative crates**: shared crate links, read-only views, collaborative annotation.
- **Mobile app**: the Web Audio API playback and drag-and-drop already work on touch; a React Native shell with the same SQLite backend would be the natural next step.
- **Practice tracking**: current/longest streak and difficulty breakdown are live in the Songscripter Profile. Per-piece practice logs, a streak calendar, and difficulty progression charts are the natural next step.
- **Export formats**: MusicXML, LilyPond — structured exports for notation software.
- **Search by MIDI content**: find pieces with similar melodic contours, harmonic progressions, or rhythmic patterns.
