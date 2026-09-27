import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../lib/runtime";

export interface RuntimeDeviceProfile {
  os_family: string;
  os_version: string | null;
  architecture: string;
  device_name: string | null;
  manufacturer: string | null;
  model: string | null;
  cpu_name: string | null;
  logical_cores: number;
  memory_bytes: number | null;
}

let profileRequest: Promise<RuntimeDeviceProfile | null> | null = null;

/** Collected once per app launch and shared by the Settings sheet and player routing. */
export function getDeviceProfile(): Promise<RuntimeDeviceProfile | null> {
  if (!profileRequest) {
    profileRequest = isTauriRuntime()
      ? invoke<RuntimeDeviceProfile>("get_device_profile").catch((error) => {
          profileRequest = null;
          throw error;
        })
      : Promise.resolve(null);
  }
  return profileRequest;
}
