export type ThemeMode = "dark" | "light";
export const THEME_STORAGE_KEY = "novus-theme";
const THEME_EVENT = "novus-theme-changed";

export function resolveTheme(storage?: Pick<Storage, "getItem">): ThemeMode {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
export function persistTheme(mode: ThemeMode, storage?: Pick<Storage, "setItem">): boolean {
  try {
    if (!storage) return false;
    storage.setItem(THEME_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
export function initializeTheme() {
  document.documentElement.classList.toggle("dark", resolveTheme(browserStorage()) === "dark");
}
export function getDarkMode(): boolean {
  return typeof document === "undefined" || document.documentElement.classList.contains("dark");
}
export function setDarkMode(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  persistTheme(dark ? "dark" : "light", browserStorage());
  window.dispatchEvent(new Event(THEME_EVENT));
}
export function subscribeTheme(callback: () => void): () => void {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      initializeTheme();
      callback();
    }
  };
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", storageChanged);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", storageChanged);
  };
}
