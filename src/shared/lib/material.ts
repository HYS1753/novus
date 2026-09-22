/**
 * Material intensity is a single 0-100 knob for how much of the backdrop
 * shows through surfaces.
 *
 *    0   opaque tints, no compositing cost — the shipped default
 *   50   balanced frosting
 *  100   maximum frosting the system allows
 *
 * The scale is bounded by design: even at 100 the tint keeps a 0.62 alpha
 * floor and the hairline edge firms up, so surfaces stay anchored to the
 * layout instead of dissolving into the backdrop.
 */
export type MaterialIntensity = number;

export const MATERIAL_INTENSITY_MIN = 0;
export const MATERIAL_INTENSITY_MAX = 100;
/** Step used by settings UI so stored values stay predictable. */
export const MATERIAL_INTENSITY_STEP = 5;

/** Frosting is opt-in: the shipped default must stay cheap to composite. */
export const DEFAULT_MATERIAL_INTENSITY: MaterialIntensity = 0;

const STORAGE_KEY = "novus.material-intensity";
const INTENSITY_PROPERTY = "--material-intensity";
const FROST_ATTRIBUTE = "data-frost";

export function clampMaterialIntensity(value: number): MaterialIntensity {
  if (!Number.isFinite(value)) return DEFAULT_MATERIAL_INTENSITY;
  return Math.min(MATERIAL_INTENSITY_MAX, Math.max(MATERIAL_INTENSITY_MIN, Math.round(value)));
}

/**
 * Descriptive band for the current value. Used for copy and telemetry only —
 * never for styling, which reads the continuous value.
 */
export function describeMaterialIntensity(value: MaterialIntensity): string {
  if (value === 0) return "Opaque";
  if (value <= 25) return "Subtle";
  if (value <= 60) return "Balanced";
  if (value <= 85) return "Deep";
  return "Maximum";
}

/** True when the OS asks for reduced transparency; frosting must yield to it. */
export function prefersReducedTransparency(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

export function readStoredMaterialIntensity(): MaterialIntensity | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const parsed = Number.parseInt(stored, 10);
    return Number.isNaN(parsed) ? null : clampMaterialIntensity(parsed);
  } catch {
    return null;
  }
}

export function resolveMaterialIntensity(): MaterialIntensity {
  return readStoredMaterialIntensity() ?? DEFAULT_MATERIAL_INTENSITY;
}

/**
 * Writes the knob to <html> so every surface token resolves from one place.
 *
 * `data-frost` gates the backdrop-filter rules entirely: at 0 the property is
 * never emitted, so integrated GPUs get no compositing layers at all.
 * Persistence is best-effort; the visual state is applied either way.
 */
export function applyMaterialIntensity(value: MaterialIntensity, persist = true): void {
  if (typeof document === "undefined") return;

  const intensity = clampMaterialIntensity(value);
  const root = document.documentElement;

  root.style.setProperty(INTENSITY_PROPERTY, String(intensity / 100));
  if (intensity > 0) {
    root.setAttribute(FROST_ATTRIBUTE, "on");
  } else {
    root.removeAttribute(FROST_ATTRIBUTE);
  }

  if (!persist || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(intensity));
  } catch {
    /* storage unavailable (private mode, quota) — visual state still applied */
  }
}
