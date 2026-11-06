import React, { useEffect, useState } from "react";
import { DashboardPage, StyleGuideV2Page } from "@/pages";
import {
  getDeviceProfile,
  isStyleGuidePath,
  isStyleGuideRouteEnabled,
  useMaterialIntensity,
  toggleFullscreen,
  WINDOW_MODE_ERROR,
  listenDisplayError,
  useResolvedTheme,
  useI18n,
  usePreference,
  NvRoot,
} from "@/shared";
import "./styles/global.css";
import "./styles/v2/tokens.css";
import "./styles/v2/base.css";
import "./styles/v2/bridge.css";
import { InAppVideoModal, Onboarding } from "@/widgets";
import type { FileItem } from "@/entities";
import { requestEmbeddedVideoOverlayAction } from "@/shared";
import { useUpdateLifecycle } from "@/features";

const overlay = (
  window as Window & { __NOVUS_VIDEO_OVERLAY__?: { sessionId: string; video: FileItem } }
).__NOVUS_VIDEO_OVERLAY__;
if (overlay) document.documentElement.classList.add("video-overlay-window");

export const App: React.FC = () => {
  const { t } = useI18n();
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
          <button onClick={() => setModeError(null)}>{t("common.close")}</button>
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

/** The design guide is a dev-browser-only route (`/styleguide`). */
function readStyleGuideRoute(): boolean {
  return isStyleGuideRouteEnabled() && isStyleGuidePath();
}

const DashboardApp: React.FC = () => {
  useUpdateLifecycle();
  const [styleGuide, setStyleGuide] = useState(() => readStyleGuideRoute());
  const [onboardingDone] = usePreference("onboardingDone");
  const showOnboarding = !styleGuide && !onboardingDone;

  // Resolves the persisted material intensity and applies it to <html>.
  useMaterialIntensity();

  // v1 screens still read `html.dark`; keep them on the v2 theme choice.
  const resolvedTheme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    // Native profile is collected once at process start and cached for the session.
    void getDeviceProfile().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isStyleGuideRouteEnabled()) return;

    const sync = () => setStyleGuide(readStyleGuideRoute());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return (
    <>
      <div className="app-ambient" aria-hidden="true" />
      <div className="app-shell">
        {showOnboarding ? (
          <NvRoot>
            <Onboarding />
          </NvRoot>
        ) : styleGuide ? (
          <StyleGuideV2Page />
        ) : (
          <DashboardPage />
        )}
      </div>
    </>
  );
};
