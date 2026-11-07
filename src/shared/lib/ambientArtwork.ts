/**
 * Bundled ambient artwork shown when the user's photo folder has no images.
 * Procedurally generated rasters (scripts/design/generate-ambient-art.py),
 * 1600×1000 JPEG, fingerprinted by Vite from `src/assets/ambient/`.
 */
const bundled = import.meta.glob<string>("/src/assets/ambient/*.jpg", {
  eager: true,
  import: "default",
});

/**
 * Vertical focal point (0 = top, 1 = bottom) of each artwork: the strip the
 * folded photo band shows on today's page. User photos default to 0.5.
 */
const FOCUS_Y: Record<string, number> = {
  "dawn-sea": 0.58,
  "misty-lake": 0.55,
  ridges: 0.5,
};

export const DEFAULT_PHOTO_FOCUS = 0.5;

export interface AmbientArtwork {
  id: string;
  url: string;
  focusY: number;
}

export const BUNDLED_AMBIENT_ARTWORK: AmbientArtwork[] = Object.entries(bundled)
  .map(([path, url]) => {
    const id = path
      .split("/")
      .pop()!
      .replace(/\.jpg$/, "");
    return { id, url, focusY: FOCUS_Y[id] ?? DEFAULT_PHOTO_FOCUS };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

/** Stable pick for a given day, offset by `step` (the ambient frame advances it). */
export function getAmbientArtworkForDay(
  date: Date = new Date(),
  step = 0,
): AmbientArtwork | undefined {
  if (BUNDLED_AMBIENT_ARTWORK.length === 0) return undefined;
  const dayIndex = Math.floor(date.getTime() / 86_400_000) + step;
  return BUNDLED_AMBIENT_ARTWORK[dayIndex % BUNDLED_AMBIENT_ARTWORK.length];
}
