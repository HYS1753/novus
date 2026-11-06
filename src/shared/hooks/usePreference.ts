import { useCallback, useSyncExternalStore } from "react";
import {
  getPreference,
  setPreference,
  subscribePreferences,
  type Preferences,
} from "../lib/preferences";

/** Reads one preference and re-renders only when the store changes. */
export function usePreference<K extends keyof Preferences>(
  key: K,
): [Preferences[K], (value: Preferences[K]) => void] {
  const value = useSyncExternalStore(subscribePreferences, () => getPreference(key));
  const update = useCallback((next: Preferences[K]) => setPreference(key, next), [key]);
  return [value, update];
}
