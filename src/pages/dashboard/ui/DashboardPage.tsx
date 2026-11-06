import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InAppPlayer, SettingsV2 } from "@/widgets";
import {
  discardStreamingPage,
  exitWindowFullscreen,
  listStreamingPages,
  markSessionUsed,
  NvRoot,
  reportWindowModeError,
  RunningAppsContext,
  STREAMING_PAGES_CHANGED,
  useDisplayMode,
  useI18n,
} from "@/shared";
import { useLaunchApp, UpdateNoticeV2 } from "@/features";
import { ALL_APPS, type AppItem } from "@/entities";
import { GalleryPage } from "../../gallery";
import { FinderPage } from "../../finder";
import { HomeV2Screen } from "./HomeV2Screen";

/** How long a closed session shows "종료됨" before it leaves the list. */
const ENDED_BEAT_MS = 1500;

type RunningError = "" | "list" | "close";

/**
 * Owns which surface is on screen (Home, a streaming page, Gallery, Finder),
 * the running-session list, and the settings sheet shared by all of them.
 */
export const DashboardPage: React.FC = () => {
  const { t } = useI18n();
  const [activeView, setActiveView] = useState<"dashboard" | "gallery" | "finder">("dashboard");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<AppItem | null>(null);
  const { launchApp } = useLaunchApp();
  const [runningIds, setRunningIds] = useState<string[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const closingRef = useRef(false);
  const [runningError, setRunningError] = useState<RunningError>("");
  const { appFullscreen } = useDisplayMode();
  const [endedIds, setEndedIds] = useState<string[]>([]);
  const [finderPath, setFinderPath] = useState<string | undefined>(undefined);
  // First launch shows the photo frame; returning from any surface lands on today's page.
  const [homeEntry, setHomeEntry] = useState<"photo" | "today">("photo");
  const leaveHome = () => setHomeEntry("today");

  // Record when each service is on screen and when the user leaves it.
  useEffect(() => {
    if (!activeApp) return;
    const id = activeApp.id;
    markSessionUsed(id);
    return () => markSessionUsed(id);
  }, [activeApp]);

  // Escape on Home leaves app fullscreen (streaming pages handle their own Escape).
  useEffect(() => {
    if (!appFullscreen || activeApp || activeView !== "dashboard" || isSettingsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !event.repeat) {
        event.preventDefault();
        void exitWindowFullscreen().catch(reportWindowModeError);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appFullscreen, activeApp, activeView, isSettingsOpen]);

  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const request = ++generation;
      void listStreamingPages()
        .then((ids) => {
          if (request === generation) setRunningIds(ids);
        })
        .catch(() => {
          if (request === generation) setRunningError("list");
        });
    };
    refresh();
    window.addEventListener(STREAMING_PAGES_CHANGED, refresh);
    return () => {
      ++generation;
      window.removeEventListener(STREAMING_PAGES_CHANGED, refresh);
    };
  }, []);

  const closeRunningApp = useCallback(
    async (id: string) => {
      if (closingRef.current) return;
      closingRef.current = true;
      setClosingId(id);
      setRunningError("");
      try {
        await discardStreamingPage(id);
        setRunningIds((ids) => ids.filter((entry) => entry !== id));
        setEndedIds((ids) => [...ids, id]);
        window.setTimeout(
          () => setEndedIds((ids) => ids.filter((entry) => entry !== id)),
          ENDED_BEAT_MS,
        );
        if (activeApp?.id === id) {
          setActiveApp(null);
          setActiveView("dashboard");
        }
      } catch {
        setRunningError("close");
      } finally {
        closingRef.current = false;
        setClosingId(null);
      }
    },
    [activeApp],
  );

  const selectRunningApp = useCallback((id: string) => {
    if (closingRef.current) return;
    const app = ALL_APPS.find((entry) => entry.id === id);
    if (app) {
      setHomeEntry("today");
      setActiveView("dashboard");
      setActiveApp(app);
    }
  }, []);

  const errorMessage =
    runningError === "list"
      ? t("home.listFailed")
      : runningError === "close"
        ? t("home.closeFailed")
        : "";

  // Gallery, Finder, and streaming run v1 components inside a bridged v2 root.
  // Gallery and streaming keep their own arrow keys, so spatial navigation is off there.
  const bridged = (content: React.ReactNode, spatialNavigation = true) => (
    <NvRoot className="nv-bridge" spatialNavigation={spatialNavigation}>
      {content}
    </NvRoot>
  );

  const runningApps = useMemo(
    () => ({
      apps: ALL_APPS.filter((app) => runningIds.includes(app.id)),
      activeId: activeApp?.id,
      closingId,
      error: errorMessage,
      onSelect: selectRunningApp,
      onClose: (id: string) => void closeRunningApp(id),
    }),
    [runningIds, activeApp, closingId, errorMessage, selectRunningApp, closeRunningApp],
  );

  const withRunningApps = (content: React.ReactNode) => (
    <RunningAppsContext.Provider value={runningApps}>{content}</RunningAppsContext.Provider>
  );

  const handleItemClick = (item: AppItem) => {
    leaveHome();
    if (item.id === "photos") {
      setActiveView("gallery");
      return;
    }
    if (item.id === "finder") {
      setActiveView("finder");
      return;
    }
    if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
      setActiveApp(item);
      return;
    }
    launchApp(item);
  };

  const settings = <SettingsV2 open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />;

  if (activeApp) {
    return withRunningApps(
      bridged(
        <div className="dashboard-page dashboard-page--in-app-mode">
          <InAppPlayer
            key={activeApp.id}
            app={activeApp}
            onClose={() => setActiveApp(null)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            suspended={isSettingsOpen}
          />
          {settings}
        </div>,
        false,
      ),
    );
  }

  if (activeView === "gallery") {
    return withRunningApps(
      bridged(<GalleryPage onBackToDashboard={() => setActiveView("dashboard")} />, false),
    );
  }

  if (activeView === "finder") {
    return withRunningApps(
      bridged(
        <FinderPage
          key={finderPath ?? "default"}
          initialPath={finderPath}
          onBackToDashboard={() => {
            setFinderPath(undefined);
            setActiveView("dashboard");
          }}
        />,
      ),
    );
  }

  return (
    <HomeV2Screen
      runningIds={runningIds}
      endedIds={endedIds}
      error={errorMessage}
      suspended={isSettingsOpen}
      onOpenItem={handleItemClick}
      onEndSession={(id) => void closeRunningApp(id)}
      entry={homeEntry}
      onOpenGallery={() => {
        leaveHome();
        setActiveView("gallery");
      }}
      onOpenFinder={(path) => {
        leaveHome();
        setFinderPath(path);
        setActiveView("finder");
      }}
      onOpenSettings={() => setIsSettingsOpen(true)}
    >
      <UpdateNoticeV2 onOpen={() => setIsSettingsOpen(true)} />
      {settings}
    </HomeV2Screen>
  );
};
