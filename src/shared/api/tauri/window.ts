import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/shared/lib/runtime";

export interface DisplayMode {
  appFullscreen: boolean;
  contentPage: string | null;
  revision: number;
}

export const WINDOW_MODE_ERROR = "novus:window-mode-error";

export function reportWindowModeError(error: unknown): void {
  console.warn("Fullscreen transition failed:", error);
  window.dispatchEvent(
    new CustomEvent(WINDOW_MODE_ERROR, {
      detail: "화면 모드를 변경하지 못했습니다. 다시 시도해 주세요.",
    }),
  );
}

export function getDisplayMode(): Promise<DisplayMode> {
  if (isTauriRuntime()) return invoke("get_display_mode");
  return Promise.resolve({
    appFullscreen: !!document.fullscreenElement,
    contentPage: null,
    revision: 0,
  });
}

export async function listenDisplayMode(
  onChange: (mode: DisplayMode) => void,
): Promise<() => void> {
  if (isTauriRuntime())
    return listen<DisplayMode>("novus-display-mode", (event) => onChange(event.payload));
  const sync = () => {
    void getDisplayMode().then(onChange);
  };
  document.addEventListener("fullscreenchange", sync);
  return () => document.removeEventListener("fullscreenchange", sync);
}

export async function listenDisplayError(): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  return listen<string>("novus-display-error", (event) => reportWindowModeError(event.payload));
}

export function exitStreamingFullscreen(id: string): Promise<void> {
  return invoke("exit_streaming_fullscreen", { id });
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (isTauriRuntime()) {
      await invoke("toggle_window_fullscreen");
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    reportWindowModeError(error);
  }
}

export async function exitWindowFullscreen(): Promise<void> {
  if (isTauriRuntime()) await invoke("exit_window_fullscreen");
  else if (document.fullscreenElement) await document.exitFullscreen();
}

export async function minimizeWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.minimize();
  } catch (error) {
    console.warn("Minimize window failed:", error);
  }
}

export async function closeWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.close();
  } catch (error) {
    console.warn("Close window failed:", error);
  }
}
