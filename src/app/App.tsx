import React, { useEffect, useState } from "react";
import { DashboardPage, StyleGuidePage } from "@/pages";
import {
  getDeviceProfile,
  isStyleGuidePath,
  isStyleGuideRouteEnabled,
  useMaterialIntensity,
} from "@/shared";
import "./styles/global.css";
import { InAppVideoModal } from "@/widgets";
import type { FileItem } from "@/entities";
import { requestEmbeddedVideoOverlayAction } from "@/shared";

const overlay = (
  window as Window & { __NOVUS_VIDEO_OVERLAY__?: { sessionId: string; video: FileItem } }
).__NOVUS_VIDEO_OVERLAY__;
if (overlay) document.documentElement.classList.add("video-overlay-window");

export const App: React.FC = () =>
  overlay ? (
    <InAppVideoModal
      video={overlay.video}
      overlaySessionId={overlay.sessionId}
      onClose={() => void requestEmbeddedVideoOverlayAction(overlay.sessionId, "close")}
      onExit={() => void requestEmbeddedVideoOverlayAction(overlay.sessionId, "exit")}
    />
  ) : (
    <DashboardApp />
  );

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
