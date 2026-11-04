import React, { useEffect, useState } from "react";
import { DashboardPage, StyleGuidePage } from "@/pages";
import {
  getDeviceProfile,
  isStyleGuidePath,
  isStyleGuideRouteEnabled,
  useMaterialIntensity,
  toggleFullscreen,
  WINDOW_MODE_ERROR,
  listenDisplayError,
} from "@/shared";
import "./styles/global.css";
import { InAppVideoModal } from "@/widgets";
import type { FileItem } from "@/entities";
import { requestEmbeddedVideoOverlayAction } from "@/shared";

const overlay = (
  window as Window & { __NOVUS_VIDEO_OVERLAY__?: { sessionId: string; video: FileItem } }
).__NOVUS_VIDEO_OVERLAY__;
if (overlay) document.documentElement.classList.add("video-overlay-window");

export const App: React.FC = () => {
  const [modeError, setModeError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F11" && !event.repeat) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    const onError = (event: Event) => setModeError((event as CustomEvent<string>).detail);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(WINDOW_MODE_ERROR, onError);
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void listenDisplayError().then((unlisten) => {
      if (cancelled) unlisten();
      else dispose = unlisten;
    });
    return () => {
      cancelled = true;
      dispose?.();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(WINDOW_MODE_ERROR, onError);
    };
  }, []);
  return (
    <>
      {modeError && (
        <div className="window-mode-error" role="alert">
          {modeError}
          <button onClick={() => setModeError(null)}>닫기</button>
        </div>
      )}
      {overlay ? (
        <InAppVideoModal
          video={overlay.video}
          overlaySessionId={overlay.sessionId}
          onClose={() => void requestEmbeddedVideoOverlayAction(overlay.sessionId, "close")}
          onExit={() => void requestEmbeddedVideoOverlayAction(overlay.sessionId, "exit")}
        />
      ) : (
        <DashboardApp />
      )}
    </>
  );
};

const DashboardApp: React.FC = () => {
  const [showStyleGuide, setShowStyleGuide] = useState(
    () => isStyleGuideRouteEnabled() && isStyleGuidePath(),
  );

  // Resolves the persisted material intensity and applies it to <html>.
  useMaterialIntensity();

  useEffect(() => {
    // Native profile is collected once at process start and cached for the session.
    void getDeviceProfile().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isStyleGuideRouteEnabled()) return;

    const sync = () => setShowStyleGuide(isStyleGuidePath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return (
    <>
      <div className="app-ambient" aria-hidden="true" />
      <div className="app-shell">{showStyleGuide ? <StyleGuidePage /> : <DashboardPage />}</div>
    </>
  );
};
