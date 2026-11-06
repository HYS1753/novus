/**
 * Bundled ambient artwork shown when the user's photo folder has no images.
 * Files live in `src/assets/ambient/` and are fingerprinted by Vite.
 */
const bundled = import.meta.glob<string>("/src/assets/ambient/*.svg", {
  eager: true,
  import: "default",
});

export interface AmbientArtwork {
  id: string;
  url: string;
}

export const BUNDLED_AMBIENT_ARTWORK: AmbientArtwork[] = Object.entries(bundled)
  .map(([path, url]) => ({
    id: path
      .split("/")
      .pop()!
      .replace(/\.svg$/, ""),
    url,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

/** Stable pick for a given day so the frame does not change on every render. */
export function getAmbientArtworkForDay(date: Date = new Date()): AmbientArtwork | undefined {
  if (BUNDLED_AMBIENT_ARTWORK.length === 0) return undefined;
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return BUNDLED_AMBIENT_ARTWORK[dayIndex % BUNDLED_AMBIENT_ARTWORK.length];
}
