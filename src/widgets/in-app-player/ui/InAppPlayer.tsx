import React, { useRef, useState, useEffect, useCallback } from "react";
import { InAppDock } from "./InAppDock";
import { InAppLoader } from "./InAppLoader";
import {
  useDockPosition,
  showStreamingPage,
  hideStreamingPage,
  updateStreamingPageBounds,
  reloadStreamingPage,
  goBackOrCloseStreamingPage,
  isTauriRuntime,
  useDisplayMode,
  exitStreamingFullscreen,
  exitWindowFullscreen,
  reportWindowModeError,
} from "@/shared";
import { useLaunchApp } from "@/features";
import type { AppItem } from "@/entities";

export interface InAppPlayerProps {
  app: AppItem;
  onClose: () => void;
  onOpenSettings?: () => void;
  suspended?: boolean;
}

export const InAppPlayer: React.FC<InAppPlayerProps> = ({
  app,
  onClose,
  onOpenSettings,
  suspended = false,
}) => {
  const { dockPosition } = useDockPosition();
  const displayMode = useDisplayMode();
  const contentFullscreen = displayMode.contentPage === app.id;
  const { launchApp } = useLaunchApp();
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPageShownRef = useRef(false);
  const visibilityTaskRef = useRef<Promise<unknown>>(Promise.resolve());

  const isTauri = isTauriRuntime();

  // Helper to sync viewport bounds to native webview
  const syncPageBounds = useCallback(() => {
    if (!isTauri || !isPageShownRef.current || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    updateStreamingPageBounds(
      app.id,
      {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      displayMode.revision < 0 ? undefined : displayMode.revision,
    );
  }, [app.id, displayMode.revision, isTauri]);

  // Show / attach native child webview via singleton page manager
  useEffect(() => {
    if (!isTauri || suspended) return;

    let isMounted = true;

    const setupChild = async () => {
      // Small tick to ensure layout and dock bounds are computed
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (!isMounted || !viewportRef.current) return;

      const rect = viewportRef.current.getBoundingClientRect();
      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };

      const shown = await showStreamingPage(app.id, app.url, bounds);
      if (shown && !isMounted) {
        await hideStreamingPage(app.id);
        return;
      }
      if (shown && isMounted) {
        isPageShownRef.current = true;
        setIsLoading(false);
      }
    };

    // Serialize show/hide so a late hide cannot cover a newly reopened page.
    visibilityTaskRef.current = visibilityTaskRef.current.then(setupChild, setupChild);

    return () => {
      isMounted = false;
      isPageShownRef.current = false;
      // In singleton page manager, hide rather than destroy to retain DOM & session cookies
      const hide = () => hideStreamingPage(app.id);
      visibilityTaskRef.current = visibilityTaskRef.current.then(hide, hide);
    };
  }, [app.id, app.url, isTauri, suspended]);

  // Dynamically adjust bounds on dockPosition changes and window resize events
  useEffect(() => {
    if (!isTauri) return;

    // 1. Re-sync on dock position change
    const dockTimer = setTimeout(syncPageBounds, 50);

    // 2. Re-sync on window resize
    const handleWindowResize = () => {
      syncPageBounds();
    };
    window.addEventListener("resize", handleWindowResize);

    // 3. Re-sync on viewport container layout resize (ResizeObserver)
    let resizeObserver: ResizeObserver | null = null;
    if (viewportRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        syncPageBounds();
      });
      resizeObserver.observe(viewportRef.current);
    }

    return () => {
      clearTimeout(dockTimer);
      window.removeEventListener("resize", handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [dockPosition, contentFullscreen, isTauri, syncPageBounds]);

  const startFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    // In web browser dev mode without Tauri, iframes may be blocked by X-Frame-Options
    fallbackTimerRef.current = setTimeout(() => {
      setShowFallbackNotice(true);
    }, 3800);
  }, []);

  useEffect(() => {
    if (!isTauri) {
      startFallbackTimer();
    }
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [app.url, isTauri, startFallbackTimer]);

  const handleIframeLoad = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    setTimeout(() => {
      setIsLoading(false);
    }, 400);
  };

  const handleHome = useCallback(() => {
    if (isTauri) {
      hideStreamingPage(app.id);
    }
    onClose();
  }, [app.id, isTauri, onClose]);

  const handleOpenExternal = useCallback(() => {
    launchApp(app);
  }, [app, launchApp]);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setShowFallbackNotice(false);

    if (isTauri) {
      reloadStreamingPage(app.id).then(() => {
        setTimeout(() => setIsLoading(false), 300);
      });
      return;
    }

    startFallbackTimer();

    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc || app.url;
        }
      }, 60);
    }
  }, [app.id, app.url, isTauri, startFallbackTimer]);

  // Back button navigation:
  // In Tauri runtime: navigates back in browser history.
  // If there's no more history to go back to, closes/discards the page to free memory and returns home.
  const handleBack = useCallback(async () => {
    if (isTauri) {
      const navigated = await goBackOrCloseStreamingPage(app.id);
      if (!navigated) {
        // Discarded in backend, now close player view and return home
        onClose();
      }
      return;
    }

    // Web browser dev mode fallback
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.back();
      } catch {
        handleHome();
      }
    } else {
      handleHome();
    }
  }, [app.id, handleHome, isTauri, onClose]);

  // Support ESC key to return home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (contentFullscreen) {
          void exitStreamingFullscreen(app.id).catch(reportWindowModeError);
        } else if (displayMode.appFullscreen) {
          void exitWindowFullscreen().catch(reportWindowModeError);
        } else {
          handleHome();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [app.id, contentFullscreen, displayMode.appFullscreen, handleHome]);

  return (
    <div
      className={`in-app-player in-app-player--dock-${dockPosition}${contentFullscreen ? " in-app-player--content-fullscreen" : ""}${suspended ? " in-app-player--suspended" : ""}`}
      style={{
        ["--app-accent" as string]: app.accentColor,
      }}
    >
      <div ref={viewportRef} className="in-app-player__viewport">
        {/* Loading overlay compliant with Novus design guide */}
        <InAppLoader
          app={app}
          isLoading={isLoading}
          showFallbackNotice={showFallbackNotice}
          onReload={handleReload}
          onOpenExternal={handleOpenExternal}
          onClose={handleHome}
        />

        {/* Fallback iframe only in browser dev server when native webview is unavailable */}
        {!isTauri && (
          <iframe
            ref={iframeRef}
            src={app.url}
            title={app.title}
            className="in-app-player__iframe"
            onLoad={handleIframeLoad}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        )}
      </div>

      {!contentFullscreen && (
        <InAppDock
          app={app}
          dockPosition={dockPosition}
          onHome={handleHome}
          onBack={handleBack}
          onReload={handleReload}
          onOpenExternal={handleOpenExternal}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
};
