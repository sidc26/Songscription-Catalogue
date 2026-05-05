import { getDb, rowToSong, getCrates } from "@/lib/db";
import { CataloguePage } from "@/components/CataloguePage";

export const dynamic = "force-dynamic";

export default function Page() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM songs ORDER BY COALESCE(last_played, created_at) DESC")
    .all() as Record<string, unknown>[];

  const songs = rows.map(rowToSong);
  const crates = getCrates();

  return <CataloguePage initialSongs={songs} initialCrates={crates} />;
}
