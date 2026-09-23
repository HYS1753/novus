import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "../../lib/runtime";

/**
 * Opens a dedicated top-level media window in Tauri runtime.
 * Operates with top === self and Chrome Desktop User-Agent, bypassing X-Frame-Options & CSP blocks.
 */
export async function openMediaWindow(id: string, title: string, url: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    await invoke("open_media_window", { id, title, url });
    return true;
  } catch (error) {
    console.warn("Failed to open media window via Tauri:", error);
    return false;
  }
}

/**
 * Closes an active media window by ID.
 */
export async function closeMediaWindow(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("close_media_window", { id });
  } catch (error) {
    console.warn("Failed to close media window:", error);
  }
}

export interface StreamingPageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Shows a streaming page in the singleton Chromium / WebView2 engine.
 * - Lazily creates the page view if it has not been opened yet.
 * - If already created, updates its bounds, makes it visible, and retains session cookies & DOM state.
 * - Automatically hides any previously visible streaming page.
 */
export async function showStreamingPage(
  id: string,
  url: string,
  bounds: StreamingPageBounds,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    await invoke("show_streaming_page", {
      id,
      url,
      bounds,
    });
    return true;
  } catch (error) {
    console.warn(`Failed to show streaming page (${id}):`, error);
    return false;
  }
}

/**
 * Hides an active streaming page from the viewport.
 * Does NOT destroy the page or browser process; state and cookies are preserved.
 */
export async function hideStreamingPage(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("hide_streaming_page", { id });
  } catch (error) {
    console.warn(`Failed to hide streaming page (${id}):`, error);
  }
}

/**
 * Updates the viewport bounds (x, y, width, height) of an existing streaming page.
 * Used when the tablet dock position or orientation changes without reloading the web page.
 */
export async function updateStreamingPageBounds(
  id: string,
  bounds: StreamingPageBounds,
): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("update_streaming_page_bounds", { id, bounds });
  } catch (error) {
    console.warn(`Failed to update streaming page bounds (${id}):`, error);
  }
}

/**
 * Reloads the contents of a streaming page without restarting the browser engine.
 */
export async function reloadStreamingPage(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("reload_streaming_page", { id });
  } catch (error) {
    console.warn(`Failed to reload streaming page (${id}):`, error);
  }
}

/**
 * Discards an inactive streaming page to free memory under low-spec conditions (Surface Pro 4).
 * The singleton browser profile remains intact.
 */
export async function discardStreamingPage(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("discard_streaming_page", { id });
  } catch (error) {
    console.warn(`Failed to discard streaming page (${id}):`, error);
  }
}

/**
 * Navigates back in the streaming page history.
 * If there is no previous history, closes/discards the page to free memory and returns false.
 * If navigation succeeds, returns true.
 */
export async function goBackOrCloseStreamingPage(id: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const navigated = await invoke<boolean>("go_back_or_close_streaming_page", { id });
    return !!navigated;
  } catch (error) {
    console.warn(`Failed to go back or close streaming page (${id}):`, error);
    return false;
  }
}

/**
 * Attaches a native streaming page to the viewport (alias of showStreamingPage).
 * Retained for backward compatibility.
 */
export async function attachChildWebview(
  id: string,
  url: string,
  bounds: StreamingPageBounds,
): Promise<boolean> {
  return showStreamingPage(id, url, bounds);
}

/**
 * Hides a native streaming page (alias of hideStreamingPage).
 * Note: Under the singleton page manager, this hides rather than destroys the view.
 */
export async function closeChildWebview(id: string): Promise<void> {
  return hideStreamingPage(id);
}

/**
 * Launches the target URL in dedicated Edge / Chrome Application Mode (PWA-style borderless window).
 * This provides 100% full hardware Widevine + PlayReady DRM playback for Netflix, Coupang Play, etc.
 */
export async function launchNativeAppMode(url: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const success = await invoke<boolean>("launch_native_app_mode", { url });
    return !!success;
  } catch (error) {
    console.warn("Native app mode launch failed:", error);
    return false;
  }
}

/**
 * Universal media player launcher.
 * Automatically chooses the best execution path to ensure 100% working OTT playback:
 * 1. Edge/Chrome Standalone App Mode (Full Widevine & PlayReady DRM)
 * 2. Tauri Dedicated WebviewWindow with Chrome User-Agent
 * 3. Browser Popup Standalone Window (bypassing X-Frame-Options & frame busting)
 */
export async function launchStreamingMedia(id: string, title: string, url: string): Promise<void> {
  if (isTauriRuntime()) {
    // 1. Attempt native PWA App Mode first for full DRM support
    const launchedAppMode = await launchNativeAppMode(url);
    if (launchedAppMode) return;

    // 2. Attempt dedicated Tauri WebviewWindow with Chrome User-Agent
    const openedWindow = await openMediaWindow(id, title, url);
    if (openedWindow) return;

    // 3. Fallback to system default opener
    try {
      await openUrl(url);
      return;
    } catch {
      // Fallback
    }
  }

  // Pure Web Dev Server / Browser environment:
  // Open top-level popup window to guarantee window.top === window.self (stops frame busting & X-Frame-Options DENY)
  if (typeof window !== "undefined") {
    const popup = window.open(
      url,
      `novus_player_${id}`,
      "popup=yes,width=1280,height=800,menubar=no,toolbar=no,location=no,status=no",
    );
    if (popup) {
      popup.focus();
      return;
    }
    // If popup was blocked by browser, open regular tab
    window.open(url, "_blank");
  }
}
