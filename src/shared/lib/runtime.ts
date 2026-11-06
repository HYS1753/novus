/**
 * True when running inside a Tauri WebView runtime.
 * Used to gate developer-only surfaces away from end-user builds.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Style Guide is available only on the Vite browser DEV server at `/styleguide`.
 * Never exposed inside Tauri (dev or production) or production web builds.
 */
export function isStyleGuideRouteEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (isTauriRuntime()) return false;
  return true;
}

export function isStyleGuidePath(pathname: string = window.location.pathname): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/styleguide";
}

export function isStyleGuideV2Path(pathname: string = window.location.pathname): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/styleguide/v2";
}

const UI_VERSION_KEY = "novus.ui";

/**
 * v2 home is the default. `?ui=v1` (persisted) brings back the v1 dashboard
 * during the transition; `?ui=v2` restores v2.
 */
export function isHomeV2Enabled(): boolean {
  try {
    const query = new URLSearchParams(window.location.search).get("ui");
    if (query === "v1" || query === "v2") localStorage.setItem(UI_VERSION_KEY, query);
    return localStorage.getItem(UI_VERSION_KEY) !== "v1";
  } catch {
    return true;
  }
}
