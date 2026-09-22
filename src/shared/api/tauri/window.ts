import { getCurrentWindow } from "@tauri-apps/api/window";

export async function toggleFullscreen(): Promise<void> {
  try {
    const win = getCurrentWindow();
    const isFull = await win.isFullscreen();
    await win.setFullscreen(!isFull);
  } catch (error) {
    console.warn("Fullscreen toggle failed:", error);
  }
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
