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
