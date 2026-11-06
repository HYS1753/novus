import { useSyncExternalStore } from "react";
import { getDarkMode, setDarkMode, subscribeTheme } from "@/shared/lib/theme";

export function useTheme() {
  const isDark = useSyncExternalStore(subscribeTheme, getDarkMode, () => true);
  return { isDark, setIsDark: setDarkMode };
}
