import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../lib/runtime";

/**
 * Launch-at-login through tauri-plugin-autostart (registered in lib.rs,
 * permitted in capabilities/default.json). Outside the desktop app the
 * feature is reported as unavailable instead of failing.
 */
export function isAutostartAvailable(): boolean {
  return isTauriRuntime();
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return await invoke<boolean>("plugin:autostart|is_enabled");
}

export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  if (!isTauriRuntime()) throw new Error("autostart unavailable outside the desktop app");
  await invoke<void>(enabled ? "plugin:autostart|enable" : "plugin:autostart|disable");
}
