import { useEffect, useState } from "react";
import {
  getDisplayMode,
  listenDisplayMode,
  reportWindowModeError,
} from "@/shared/api/tauri/window";
import type { DisplayMode } from "@/shared/api/tauri/window";

export function useDisplayMode() {
  const [mode, setMode] = useState<DisplayMode>({
    appFullscreen: false,
    contentPage: null,
    revision: -1,
  });
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const update = (next: DisplayMode) => {
      if (!cancelled) setMode((prev) => (next.revision >= prev.revision ? next : prev));
    };
    void listenDisplayMode(update)
      .then(async (unlisten) => {
        if (cancelled) {
          unlisten();
          return;
        }
        dispose = unlisten;
        update(await getDisplayMode());
      })
      .catch(reportWindowModeError);
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return mode;
}
