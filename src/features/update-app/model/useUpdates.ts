import { useEffect, useSyncExternalStore } from "react";
import {
  getUpdateState,
  listenUpdateState,
  setAutomaticUpdates,
  checkForUpdate,
  downloadUpdate,
  cancelUpdate,
  installUpdate,
} from "@/shared";
import { createUpdateController } from "@/features/update-app/model/controller";

export const updateController = createUpdateController({
  api: {
    getState: getUpdateState,
    listen: listenUpdateState,
    setAutomatic: setAutomaticUpdates,
    check: checkForUpdate,
    download: downloadUpdate,
    cancel: cancelUpdate,
    install: installUpdate,
  },
  now: () => Date.now(),
  online: () => navigator.onLine,
  setTimer: (callback, delay) => window.setTimeout(callback, delay),
  clearTimer: (handle) => window.clearTimeout(handle as number),
});
export function useUpdateLifecycle() {
  useEffect(() => {
    const stop = updateController.start();
    const wake = () => {
      if (!document.hidden) updateController.wake();
    };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stop();
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
}
export function useUpdates() {
  return useSyncExternalStore(
    updateController.subscribe,
    updateController.getSnapshot,
    updateController.getSnapshot,
  );
}
export function useUpdateNotice() {
  return useSyncExternalStore(updateController.subscribe, () => {
    const view = updateController.getSnapshot();
    const state = view.initialized ? view.state : null;
    return state && (state.phase === "ready" || state.phase === "available")
      ? `${state.phase}:${state.availableVersion ?? ""}`
      : "";
  });
}
