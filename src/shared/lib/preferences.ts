/**
 * v2 user preferences: one JSON record in localStorage with an in-memory
 * fallback, so private or locked-down webviews keep working for the session.
 * Components read it through `usePreference` (useSyncExternalStore).
 */
export type ThemePreference = "system" | "light" | "dark";
export type PosturePreference = "tablet" | "tv";
export type LanguagePreference = "ko" | "en" | "ja" | "zh-CN";

export interface WeatherCity {
  name: string;
  latitude: number;
  longitude: number;
  /** IANA zone reported by the geocoder, for display only. */
  timezone?: string;
}

export interface Preferences {
  /** `null` until the user picks one in onboarding or settings. */
  language: LanguagePreference | null;
  posture: PosturePreference;
  theme: ThemePreference;
  onboardingDone: boolean;
  /** Folder the home photo and ambient frame draw from. `null` = OS Pictures. */
  ambientFolder: string | null;
  /** Minutes of no input before the ambient frame takes over. 0 = never. */
  ambientDelayMinutes: number;
  weatherCity: WeatherCity | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  language: null,
  posture: "tablet",
  theme: "system",
  onboardingDone: false,
  ambientFolder: null,
  ambientDelayMinutes: 10,
  weatherCity: null,
};

export const PREFERENCES_STORAGE_KEY = "novus.v2.preferences";
type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
let memory: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  try {
    return loadPreferences(window.localStorage);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Validate persisted data and migrate the pre-V2 theme without deleting its backup. */
export function loadPreferences(storage?: PreferenceStorage): Preferences {
  const result = { ...DEFAULT_PREFERENCES };
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PREFERENCES_STORAGE_KEY) ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      saved = parsed as Record<string, unknown>;
  } catch {
    // A damaged record does not prevent migrating an intact legacy theme.
  }
  if (["system", "light", "dark"].includes(saved.theme as string)) {
    result.theme = saved.theme as ThemePreference;
  } else {
    try {
      const legacy = storage?.getItem("novus-theme");
      if (legacy === "light" || legacy === "dark") result.theme = legacy;
    } catch {
      // Blocked storage keeps the defaults available for this session.
    }
  }
  if (["ko", "en", "ja", "zh-CN"].includes(saved.language as string))
    result.language = saved.language as LanguagePreference;
  if (saved.posture === "tablet" || saved.posture === "tv") result.posture = saved.posture;
  if (typeof saved.onboardingDone === "boolean") result.onboardingDone = saved.onboardingDone;
  if (typeof saved.ambientFolder === "string") result.ambientFolder = saved.ambientFolder;
  if (
    typeof saved.ambientDelayMinutes === "number" &&
    Number.isFinite(saved.ambientDelayMinutes) &&
    [0, 5, 10, 30].includes(saved.ambientDelayMinutes)
  )
    result.ambientDelayMinutes = saved.ambientDelayMinutes;
  const city = saved.weatherCity as Partial<WeatherCity> | null | undefined;
  if (
    city &&
    typeof city.name === "string" &&
    typeof city.latitude === "number" &&
    Number.isFinite(city.latitude) &&
    Math.abs(city.latitude) <= 90 &&
    typeof city.longitude === "number" &&
    Number.isFinite(city.longitude) &&
    Math.abs(city.longitude) <= 180
  ) {
    result.weatherCity = {
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      ...(typeof city.timezone === "string" ? { timezone: city.timezone } : {}),
    };
  }
  try {
    storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Keep legacy data untouched; the next startup can retry migration.
  }
  return result;
}

export function getPreferences(): Preferences {
  return memory;
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return memory[key];
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  if (Object.is(memory[key], value)) return;
  memory = { ...memory, [key]: value };
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage unavailable: the in-memory value still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
