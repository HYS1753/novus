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

const STORAGE_KEY = "novus.v2.preferences";
let memory: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage unavailable: the in-memory value still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
