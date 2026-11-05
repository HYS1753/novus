import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/shared/lib/runtime";

export type UpdatePhase =
  | "unsupported"
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";
export interface UpdateFailure {
  code:
    | "forbidden"
    | "unsupported"
    | "busy"
    | "stale_update"
    | "cancelled"
    | "configuration"
    | "preferences"
    | "network"
    | "timeout"
    | "release_unavailable"
    | "invalid_release"
    | "signature"
    | "storage"
    | "too_large"
    | "installation_required"
    | "internal"
    | "updater";
  message: string;
}
export interface UpdateState {
  automaticEnabled: boolean;
  preferencesReady: boolean;
  preferenceSaving: boolean;
  preferenceError: UpdateFailure | null;
  supported: boolean;
  canInstall: boolean;
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion: string | null;
  notes: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  error: UpdateFailure | null;
  revision: number;
}

const browserState: UpdateState = {
  automaticEnabled: false,
  preferencesReady: true,
  preferenceSaving: false,
  preferenceError: null,
  supported: false,
  canInstall: false,
  phase: "unsupported",
  currentVersion: "",
  availableVersion: null,
  notes: null,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  revision: 0,
};

export function getUpdateState(): Promise<UpdateState> {
  return isTauriRuntime() ? invoke("get_update_state") : Promise.resolve({ ...browserState });
}
function command(
  name: string,
  args?: { expectedVersion?: string; automatic?: boolean; enabled?: boolean },
): Promise<UpdateState> {
  if (!isTauriRuntime())
    return Promise.reject({
      code: "unsupported",
      message: "데스크톱 앱에서만 업데이트를 사용할 수 있습니다.",
    } satisfies UpdateFailure);
  return invoke(name, args);
}
export const setAutomaticUpdates = (enabled: boolean): Promise<UpdateState> =>
  command("set_update_automatic", { enabled });
export const checkForUpdate = (automatic = false): Promise<UpdateState> =>
  command("check_for_update", { automatic });
export const downloadUpdate = (expectedVersion: string, automatic = false): Promise<UpdateState> =>
  command("download_update", { expectedVersion, automatic });
/** Launches NSIS and exits the installed app after a final signature check. */
export const installUpdate = (expectedVersion: string): Promise<UpdateState> =>
  command("install_update", { expectedVersion });
export const cancelUpdate = (): Promise<UpdateState> => command("cancel_update");
export function listenUpdateState(onChange: (state: UpdateState) => void): Promise<() => void> {
  return isTauriRuntime()
    ? listen<UpdateState>("novus-update-state", (event) => onChange(event.payload))
    : Promise.resolve(() => {});
}
