import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning!";
  if (h >= 12 && h < 18) return "Good afternoon!";
  return "Good evening!";
}

// Colors are hand-picked to match the emotional character of each mood label,
// NOT derived from the song title or a hash. This ensures the accent strip on a
// "Peaceful" card always reads as calm green regardless of which song it is.
const MOOD_COLORS: Record<string, string> = {
  Energetic:   "#F97316", // orange
  Melancholic: "#818CF8", // indigo
  Peaceful:    "#34D399", // emerald
  Intense:     "#EF4444", // red
  Playful:     "#FBBF24", // amber
  Romantic:    "#F472B6", // pink
  Mysterious:  "#A78BFA", // violet
  Triumphant:  "#2DD4BF", // teal
};

export function cardColor(mood: string): string {
  return MOOD_COLORS[mood] ?? "#94A3B8"; // slate fallback when no mood set
}

export function stripExtension(name: string): string {
  return name.replace(/\.(mid|midi)$/i, "");
}
