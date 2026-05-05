# Schema Reference

## Database

SQLite at `.data/songs.db`. Created automatically on first server start. WAL mode enabled for write performance. No migration tooling required — `CREATE TABLE IF NOT EXISTS` handles all schema initialisation.

---

## Tables

### `songs`

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `INTEGER` | `AUTOINCREMENT` | Primary key |
| `filename` | `TEXT` | — | UUID filename on disk (`public/uploads/<uuid>.mid`) |
| `original_name` | `TEXT` | — | Original uploaded filename, displayed in the UI |
| `title` | `TEXT` | — | User-provided song title |
| `artist` | `TEXT` | `''` | Composer or performer |
| `instrument` | `TEXT` | `''` | Target instrument for this transcription |
| `genre` | `TEXT` | `''` | One of the fixed genre options |
| `mood` | `TEXT` | `''` | One of the fixed mood options |
| `folder` | `TEXT` | `'Collection'` | Full crate path, slash-separated (e.g. `Jazz/Bebop`) |
| `difficulty` | `TEXT` | `''` | Beginner / Intermediate / Advanced / Expert |
| `duration_sec` | `REAL` | `0` | Total duration in seconds, derived from MIDI |
| `tempo_bpm` | `REAL` | `120` | Primary tempo in BPM, derived from MIDI |
| `track_count` | `INTEGER` | `1` | Number of MIDI tracks |
| `note_count` | `INTEGER` | `0` | Total note events across all tracks |
| `format` | `INTEGER` | `1` | MIDI format (0, 1, or 2) |
| `ticks_per_qn` | `INTEGER` | `480` | Ticks per quarter note (PPQN) |
| `instrument_names` | `TEXT` | `'[]'` | JSON array of track instrument names |
| `key_signature` | `TEXT` | `''` | e.g. `C Major`, `A Minor` |
| `time_signature` | `TEXT` | `''` | e.g. `4/4`, `6/8` |
| `transcription_type` | `TEXT` | `'direct'` | `direct` or `arrangement` |
| `tags` | `TEXT` | `'[]'` | JSON array of user-supplied tag strings |
| `is_favorite` | `INTEGER` | `0` | Boolean (0/1) |
| `play_count` | `INTEGER` | `0` | Number of times played in the app |
| `last_played` | `TEXT` | `NULL` | ISO 8601 datetime of last playback |
| `share_count` | `INTEGER` | `0` | Number of times the share action was triggered |
| `ai_summary` | `TEXT` | `NULL` | JSON-serialised `AISummary` object (cached after first generation) |
| `created_at` | `TEXT` | `datetime('now')` | ISO 8601 creation timestamp |

**Indexes**

| Index | Column(s) | Purpose |
|---|---|---|
| `idx_songs_last_played` | `last_played DESC` | Recent songs query |
| `idx_songs_created` | `created_at DESC` | Date-added sort |
| `idx_songs_favorite` | `is_favorite DESC` | Favorites filter |
| `idx_songs_folder` | `folder` | Crate filter |
| `idx_songs_title` | `title` | Title sort |

---

### `crates`

| Column | Type | Description |
|---|---|---|
| `path` | `TEXT PRIMARY KEY` | Full slash-separated crate path, e.g. `Jazz/Bebop` |

Crates are stored independently of songs so empty crates persist across page reloads. When a crate is created, all ancestor paths are also inserted (`INSERT OR IGNORE`) to keep the tree consistent. When a crate is deleted, all descendants matching `path LIKE 'Jazz/%'` are removed in the same statement.

The `songs.folder` column references crate paths by convention, not by foreign key — this avoids constraint violations when crates are deleted (songs are moved to `Collection` at the application layer before the crate is dropped).

---

## `AISummary` JSON shape

Stored as a JSON string in `songs.ai_summary`.

```ts
interface AISummary {
  facts: string[];    // 3 interesting or essential facts about the piece and its history
  tips: string[];     // 3 specific, actionable practice recommendations
  related: Array<{
    title: string;    // Related piece worth studying
    artist: string;   // Composer or performer
    reason: string;   // One sentence explaining the musical connection
  }>;
}
```

---

## API Routes

### Crates

| Method | Path | Body / Params | Description |
|---|---|---|---|
| `GET` | `/api/crates` | — | Returns `string[]` of all crate paths, sorted |
| `POST` | `/api/crates` | `{ path: string }` | Creates path and all ancestor paths; rejects paths deeper than 5 levels (400) |
| `DELETE` | `/api/crates?path=Jazz/Bebop` | `?path=` query param | Deletes path and all descendants |

---

### Songs

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/songs` | — | Returns all songs ordered by `COALESCE(last_played, created_at) DESC` |
| `POST` | `/api/songs` | Full song fields | Creates a new song record |
| `GET` | `/api/songs/[id]` | — | Returns one song |
| `PATCH` | `/api/songs/[id]` | Partial song fields | Updates one or more fields |
| `DELETE` | `/api/songs/[id]` | — | Deletes the song record and removes the MIDI file from `public/uploads/` |

PATCH accepts any subset of song fields. JSON array fields (`tags`, `instrument_names`) must be passed as arrays and are serialised server-side.

---

### Upload

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/upload` | `multipart/form-data` with `file` | Validates (magic bytes + parse), saves to `public/uploads/`, returns `{ filename, original_name, midi }` |

**Validation sequence:**
1. Extension check (`.mid` / `.midi`)
2. Size check (14 bytes – 10 MB)
3. Magic bytes check (`MThd` = `0x4D546864` at bytes 0–3)
4. Write to `public/uploads/<uuid>.mid`
5. Full structural parse via `parseMidi()`; file deleted on failure

The `midi` object in the response contains the parsed MIDI data used to pre-populate the wizard (duration, tempo, track count, etc.).

---

### AI Summary

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/songs/[id]/ai-summary` | — | Generates AI summary for song `id` via Groq, caches in `songs.ai_summary`, returns `AISummary` |

Uses `llama-3.3-70b-versatile` via Groq. The prompt instructs the model to act as an expert music teacher. The song's title, artist, key, time signature, tempo, genre, and note count are included. Results are cached — subsequent calls return the cached value unless the record is cleared.

---

### Profile Summary

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/profile-summary` | `{ stats: ProfileStats }` | Generates a 2–3 sentence "transcriber identity" description from library stats, returns `{ summary, generated_at }` |

Uses `llama-3.3-70b-versatile` at temperature 0.9. Not cached server-side — the client caches the result in `localStorage` keyed as `profile_summary`. The `ProfileStats` payload is computed entirely client-side from the songs array; no additional database query is needed.
