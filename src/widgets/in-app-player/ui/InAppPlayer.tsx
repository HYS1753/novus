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
} from "@/shared";
import { useLaunchApp } from "@/features";
import type { AppItem } from "@/entities";

export interface InAppPlayerProps {
  app: AppItem;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const InAppPlayer: React.FC<InAppPlayerProps> = ({ app, onClose, onOpenSettings }) => {
  const { dockPosition } = useDockPosition();
  const { launchApp } = useLaunchApp();
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPageShownRef = useRef(false);

  const isTauri = isTauriRuntime();

  // Helper to sync viewport bounds to native webview
  const syncPageBounds = useCallback(() => {
    if (!isTauri || !isPageShownRef.current || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    updateStreamingPageBounds(app.id, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, [app.id, isTauri]);

  // Show / attach native child webview via singleton page manager
  useEffect(() => {
    if (!isTauri) return;

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
      if (shown && isMounted) {
        isPageShownRef.current = true;
        setIsLoading(false);
      }
    };

    setupChild();

    return () => {
      isMounted = false;
      isPageShownRef.current = false;
      // In singleton page manager, hide rather than destroy to retain DOM & session cookies
      hideStreamingPage(app.id);
    };
  }, [app.id, app.url, isTauri]);

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
  }, [dockPosition, isTauri, syncPageBounds]);

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
        handleHome();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleHome]);

  return (
    <div
      className={`in-app-player in-app-player--dock-${dockPosition}`}
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

      <InAppDock
        app={app}
        dockPosition={dockPosition}
        onHome={handleHome}
        onBack={handleBack}
        onReload={handleReload}
        onOpenExternal={handleOpenExternal}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
};
