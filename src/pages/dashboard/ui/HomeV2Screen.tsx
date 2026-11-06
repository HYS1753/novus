import React, { useEffect, useMemo, useState } from "react";
import {
  getSessionLastUsed,
  getSystemLocations,
  NvButton,
  NvDialog,
  NvEmptyState,
  NvListRow,
  NvListSection,
  NvRoot,
  NvSheet,
  NvTextField,
  SearchIcon,
  useI18n,
  useNow,
  usePreference,
  type QuickLocation,
} from "@/shared";
import { useAmbientPhoto, useIdle, useWeather } from "@/features";
import { ALL_APPS, SMART_TOOLS, STREAMING_APPS, type AppItem } from "@/entities";
import { HomeV2, type HomeLocation, type HomeService } from "@/widgets";

/** Photo rotation while the home is in use vs. in the ambient frame. */
const HOME_ROTATE_MS = 10 * 60_000;
const AMBIENT_ROTATE_MS = 60_000;
/** Explorer row shows at most this many drives to keep the row to one line. */
const MAX_DRIVES = 3;

const tool = (id: string) => SMART_TOOLS.find((item) => item.id === id);

function resolveDark(theme: "system" | "light" | "dark") {
  if (theme !== "system") return theme === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export interface HomeV2ScreenProps {
  runningIds: string[];
  endedIds: string[];
  /** Localized running-list error, empty when there is none. */
  error: string;
  /** True while a v1 overlay (settings) covers the home. */
  suspended: boolean;
  onOpenItem: (item: AppItem) => void;
  onEndSession: (id: string) => void;
  onOpenGallery: () => void;
  onOpenFinder: (path?: string) => void;
  onOpenSettings: () => void;
  /** Settings sheet and update notice, rendered inside the v2 root. */
  children?: React.ReactNode;
}

export const HomeV2Screen: React.FC<HomeV2ScreenProps> = ({
  runningIds,
  endedIds,
  error,
  suspended,
  onOpenItem,
  onEndSession,
  onOpenGallery,
  onOpenFinder,
  onOpenSettings,
  children,
}) => {
  const { t } = useI18n();
  const now = useNow();
  const [theme, setTheme] = usePreference("theme");
  const [delay] = usePreference("ambientDelayMinutes");
  const [searchOpen, setSearchOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<QuickLocation[]>([]);
  const overlayOpen = suspended || searchOpen || remoteOpen;
  const { idle, wake, sleep } = useIdle(delay, !overlayOpen);
  const photo = useAmbientPhoto(idle ? AMBIENT_ROTATE_MS : HOME_ROTATE_MS);
  const weather = useWeather();

  useEffect(() => {
    let cancelled = false;
    getSystemLocations()
      .then((result) => {
        if (!cancelled) setLocations(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const services: HomeService[] = STREAMING_APPS.map((app) => ({
    id: app.id,
    name: app.title,
    state: endedIds.includes(app.id) ? "ended" : runningIds.includes(app.id) ? "live" : "idle",
    lastUsed: getSessionLastUsed(app.id),
  }));

  const homeLocations: HomeLocation[] = [
    ...locations
      .filter((location) => location.category === "downloads")
      .map((location) => ({ label: t("home.downloads"), path: location.path })),
    ...locations
      .filter((location) => location.category === "drive")
      .slice(0, MAX_DRIVES)
      .map((location) => ({
        label: /^[A-Z]:\\$/.test(location.path) ? location.path : location.name,
        path: location.path,
      })),
  ];

  const openById = (id: string) => {
    const item = ALL_APPS.find((entry) => entry.id === id);
    if (item) onOpenItem(item);
  };

  // Internal tools carry localized names; services keep their proper names.
  const titleOf = (app: AppItem) =>
    app.id === "photos" ? t("gallery.title") : app.id === "finder" ? t("finder.title") : app.title;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ALL_APPS.filter((app) => app.category !== "system");
    return ALL_APPS.filter(
      (app) => app.category !== "system" && titleOf(app).toLowerCase().includes(needle),
    );
    // titleOf only depends on the language, which `t` tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, t]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <NvRoot className="nv-home-screen" spatialNavigation={!idle}>
      <HomeV2
        now={now}
        photoUrl={photo.url}
        photoFocus={photo.focusY}
        weather={weather}
        services={services}
        locations={homeLocations}
        ambient={idle}
        error={error || undefined}
        onOpenService={openById}
        onEndSession={onEndSession}
        onOpenGallery={onOpenGallery}
        onOpenFinder={onOpenFinder}
        onOpenSettings={onOpenSettings}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenCalendar={() => {
          const calendar = tool("calendar");
          if (calendar) onOpenItem(calendar);
        }}
        onOpenRadio={() => {
          const radio = tool("radio");
          if (radio) onOpenItem(radio);
        }}
        onOpenRemote={() => setRemoteOpen(true)}
        onEnterAmbient={sleep}
        onWake={wake}
        onToggleTheme={() => setTheme(resolveDark(theme) ? "light" : "dark")}
        shortcutsEnabled={!overlayOpen}
      />

      {children}

      <NvSheet
        open={searchOpen}
        title={t("search.title")}
        onClose={closeSearch}
        closeLabel={t("common.close")}
      >
        <NvTextField
          label={t("search.field")}
          value={query}
          onChange={setQuery}
          leading={<SearchIcon size={18} />}
          data-autofocus
        />
        {results.length > 0 ? (
          <NvListSection>
            {results.map((app) => (
              <NvListRow
                key={app.id}
                title={titleOf(app)}
                onPress={() => {
                  closeSearch();
                  onOpenItem(app);
                }}
              />
            ))}
          </NvListSection>
        ) : (
          <NvEmptyState
            title={t("search.noResult")}
            action={
              <NvButton
                onClick={() => {
                  closeSearch();
                  openById("browser");
                }}
              >
                {t("search.web")}
              </NvButton>
            }
          />
        )}
      </NvSheet>

      <NvDialog
        open={remoteOpen}
        title={t("home.remoteSoonTitle")}
        description={t("home.remoteSoonBody")}
        onClose={() => setRemoteOpen(false)}
        actions={
          <NvButton variant="primary" onClick={() => setRemoteOpen(false)}>
            {t("common.confirm")}
          </NvButton>
        }
      />
    </NvRoot>
  );
};
