/**
 * The 0-100 "사진 위 글자 배경" knob. It once set how much backdrop showed
 * through frosted surfaces; in v2 it only sets the scrim strength under
 * text on photos (`--nv-scrim-strength`). Nothing uses backdrop-filter.
 *
 *    0   the lightest scrim (0.78 at the darkest point) — the default
 *  100   the strongest scrim (0.95)
 */
export type MaterialIntensity = number;

export const MATERIAL_INTENSITY_MIN = 0;
export const MATERIAL_INTENSITY_MAX = 100;
/** Step used by settings UI so stored values stay predictable. */
export const MATERIAL_INTENSITY_STEP = 5;

/** Default: the lightest scrim that still keeps white text legible. */
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

/** True when the OS asks for reduced transparency (the scrim then goes to full strength in CSS). */
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
 * Writes the knob to <html> (`--material-intensity`, 0..1), read by the v2
 * scrim. Persistence is best-effort; the visual state is applied either way.
 */
export function applyMaterialIntensity(value: MaterialIntensity, persist = true): void {
  if (typeof document === "undefined") return;

  const intensity = clampMaterialIntensity(value);
  const root = document.documentElement;

  root.style.setProperty(INTENSITY_PROPERTY, String(intensity / 100));
  // No surface frosts any more (no backdrop-filter on the HD 515); clear the
  // flag older builds may have left behind.
  root.removeAttribute(FROST_ATTRIBUTE);

  if (!persist || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(intensity));
  } catch {
    /* storage unavailable (private mode, quota) — visual state still applied */
  }
}
