import { useSyncExternalStore } from "react";
import { usePreference } from "./usePreference";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(listener: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}

/** "light" or "dark" after applying the user's choice over the OS setting. */
export function useResolvedTheme(): "light" | "dark" {
  const [theme] = usePreference("theme");
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? true,
  );
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}
