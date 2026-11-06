import React, { useEffect, useState } from "react";
import {
  getDeviceProfile,
  getEmbeddedPlayerSupport,
  isAutostartAvailable,
  isAutostartEnabled,
  LANGUAGES,
  NvButton,
  NvEmptyState,
  NvListRow,
  NvListSection,
  NvSegmented,
  NvSheet,
  NvSlider,
  NvStatus,
  NvTextField,
  NvToggle,
  SearchIcon,
  searchCities,
  setAutostartEnabled,
  toggleFullscreen,
  useDisplayMode,
  useDockPosition,
  useI18n,
  useMaterialIntensity,
  usePreference,
  type CitySearchResult,
  type DockPosition,
  type PosturePreference,
  type RuntimeDeviceProfile,
  type ThemePreference,
} from "@/shared";
import { FolderPicker, UpdateSettingsV2 } from "@/features";
import "./settings-v2.css";

type View = "main" | "language" | "folder" | "city";

const AMBIENT_DELAYS = [0, 5, 10, 30] as const;

export interface SettingsV2Props {
  open: boolean;
  onClose: () => void;
}

/** v2 settings: one sheet, grouped rows, sub-views for language, photo folder, and city. */
export const SettingsV2: React.FC<SettingsV2Props> = ({ open, onClose }) => {
  const { t, language, locale } = useI18n();
  const [view, setView] = useState<View>("main");
  const [, setLanguage] = usePreference("language");
  const [posture, setPosture] = usePreference("posture");
  const [theme, setTheme] = usePreference("theme");
  const [folder, setFolder] = usePreference("ambientFolder");
  const [delay, setDelay] = usePreference("ambientDelayMinutes");
  const [city, setCity] = usePreference("weatherCity");
  const { intensity, setIntensity } = useMaterialIntensity();
  const { dockPosition, setDockPosition } = useDockPosition();
  const { appFullscreen } = useDisplayMode();

  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartError, setAutostartError] = useState(false);
  const [device, setDevice] = useState<RuntimeDeviceProfile | null | undefined>();
  const [nativePlayer, setNativePlayer] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitySearchResult[] | null>(null);
  const [cityError, setCityError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    if (isAutostartAvailable()) {
      isAutostartEnabled()
        .then((enabled) => active && setAutostart(enabled))
        .catch(() => active && setAutostart(null));
    }
    getDeviceProfile()
      .then((profile) => active && setDevice(profile))
      .catch(() => active && setDevice(null));
    getEmbeddedPlayerSupport()
      .then((support) => active && setNativePlayer(support.available))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  // City search: debounced, aborted when the query changes.
  useEffect(() => {
    if (view !== "city") return;
    const needle = query.trim();
    if (needle.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchCities(needle, language === "zh-CN" ? "zh" : language, controller.signal)
        .then((found) => {
          setResults(found);
          setCityError(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setCityError(true);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, view, language]);

  // Short queries show nothing; results from an older query are hidden, not cleared.
  const searching = query.trim().length >= 2;
  const cityResults = searching ? results : null;
  const showCityError = searching && cityError;

  const close = () => {
    setView("main");
    setQuery("");
    onClose();
  };
  const back = () => setView("main");

  const toggleAutostart = async (enabled: boolean) => {
    setAutostartError(false);
    try {
      await setAutostartEnabled(enabled);
      setAutostart(await isAutostartEnabled());
    } catch {
      setAutostartError(true);
    }
  };

  const languageName = LANGUAGES.find((option) => option.code === language)?.nativeName ?? "";
  const titles: Record<View, string> = {
    main: t("settings.title"),
    language: t("settings.language"),
    folder: t("folder.title"),
    city: t("settings.weatherCity"),
  };
  const memory =
    device?.memory_bytes != null
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(device.memory_bytes / 1024 ** 3)} GB`
      : t("common.unavailable");
  const deviceName = device
    ? [device.manufacturer, device.model].filter(Boolean).join(" ") ||
      device.device_name ||
      t("device.thisDevice")
    : device === null
      ? t("device.unknown")
      : t("device.checking");

  return (
    <NvSheet
      open={open}
      title={titles[view]}
      onClose={close}
      onBack={view === "main" ? undefined : back}
      closeLabel={t("common.close")}
      backLabel={t("common.back")}
    >
      {view === "main" && (
        <>
          <NvListSection title={t("settings.section.display")}>
            <NvListRow
              title={t("settings.language")}
              value={languageName}
              onPress={() => setView("language")}
            />
            <NvListRow
              title={t("settings.posture")}
              description={
                posture === "tv" ? t("settings.posture.tvHint") : t("settings.posture.tabletHint")
              }
              stacked
              control={
                <NvSegmented<PosturePreference>
                  label={t("settings.posture")}
                  value={posture}
                  onChange={setPosture}
                  options={[
                    { value: "tablet", label: t("settings.posture.tablet") },
                    { value: "tv", label: t("settings.posture.tv") },
                  ]}
                />
              }
            />
            <NvListRow
              title={t("settings.theme")}
              stacked
              control={
                <NvSegmented<ThemePreference>
                  label={t("settings.theme")}
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: "system", label: t("settings.theme.system") },
                    { value: "light", label: t("settings.theme.light") },
                    { value: "dark", label: t("settings.theme.dark") },
                  ]}
                />
              }
            />
            <NvListRow
              title={t("settings.scrim")}
              description={t("settings.scrimHint")}
              stacked
              control={
                <NvSlider
                  label={t("settings.scrim")}
                  value={intensity}
                  step={5}
                  valueText={String(intensity)}
                  onChange={setIntensity}
                />
              }
            />
            <NvListRow
              title={t("settings.fullscreen")}
              description={t("settings.fullscreenHint")}
              control={
                <NvToggle
                  label={t("settings.fullscreen")}
                  checked={appFullscreen}
                  onChange={() => void toggleFullscreen()}
                />
              }
            />
          </NvListSection>

          <NvListSection title={t("settings.section.home")}>
            <NvListRow
              title={t("settings.ambientFolder")}
              value={folder ?? t("settings.ambientFolderDefault")}
              onPress={() => setView("folder")}
            />
            <NvListRow
              title={t("settings.ambientDelay")}
              stacked
              control={
                <NvSegmented<string>
                  label={t("settings.ambientDelay")}
                  value={String(delay)}
                  onChange={(value) => setDelay(Number(value))}
                  options={AMBIENT_DELAYS.map((minutes) => ({
                    value: String(minutes),
                    label:
                      minutes === 0
                        ? t("settings.ambientDelay.never")
                        : t("settings.ambientDelay.minutes", { count: minutes }),
                  }))}
                />
              }
            />
            <NvListRow
              title={t("settings.weatherCity")}
              value={city?.name ?? t("settings.weatherCityNone")}
              onPress={() => setView("city")}
            />
            <NvListRow
              title={t("settings.dock")}
              description={t("settings.dockHint")}
              stacked
              control={
                <NvSegmented<DockPosition>
                  label={t("settings.dock")}
                  value={dockPosition}
                  onChange={setDockPosition}
                  options={[
                    { value: "right", label: t("settings.dock.right") },
                    { value: "left", label: t("settings.dock.left") },
                    { value: "bottom", label: t("settings.dock.bottom") },
                  ]}
                />
              }
            />
          </NvListSection>

          <NvListSection title={t("settings.section.system")}>
            <NvListRow
              title={t("settings.autostart")}
              description={
                isAutostartAvailable()
                  ? t("settings.autostartHint")
                  : t("settings.autostartUnavailable")
              }
              control={
                <NvToggle
                  label={t("settings.autostart")}
                  checked={!!autostart}
                  disabled={!isAutostartAvailable() || autostart === null}
                  onChange={(enabled) => void toggleAutostart(enabled)}
                />
              }
            />
            {autostartError && (
              <p className="nv-settings__issue" role="alert">
                <NvStatus tone="attention">{t("settings.autostartError")}</NvStatus>
              </p>
            )}
          </NvListSection>

          <UpdateSettingsV2 />

          <NvListSection title={t("settings.device")}>
            <NvListRow title={deviceName} description={device?.device_name ?? undefined} />
            {device && (
              <>
                <NvListRow title={t("device.os")} value={device.os_version || device.os_family} />
                <NvListRow
                  title={t("device.cpu")}
                  value={device.cpu_name || t("common.unavailable")}
                />
                <NvListRow title={t("device.memory")} value={memory} />
                <NvListRow
                  title={t("device.architecture")}
                  value={t("device.cores", {
                    arch: device.architecture,
                    count: device.logical_cores,
                  })}
                />
                <NvListRow
                  title={t("device.video")}
                  value={nativePlayer ? t("device.videoMpv") : t("device.videoWeb")}
                />
              </>
            )}
          </NvListSection>
        </>
      )}

      {view === "language" && (
        <NvListSection>
          {LANGUAGES.map((option) => (
            <NvListRow
              key={option.code}
              title={option.nativeName}
              value={option.code === language ? t("common.current") : undefined}
              onPress={() => {
                setLanguage(option.code);
                back();
              }}
            />
          ))}
        </NvListSection>
      )}

      {view === "folder" && (
        <FolderPicker
          initialPath={folder}
          onPick={(path) => {
            setFolder(path);
            back();
          }}
        />
      )}

      {view === "city" && (
        <div className="nv-settings__city">
          <NvTextField
            label={t("settings.weatherSearch")}
            hint={t("settings.weatherSearchHint")}
            value={query}
            onChange={setQuery}
            leading={<SearchIcon size={18} />}
            error={showCityError ? t("settings.weatherError") : undefined}
            data-autofocus
          />
          {cityResults && cityResults.length === 0 && (
            <NvEmptyState title={t("settings.weatherNoResult")} />
          )}
          {cityResults && cityResults.length > 0 && (
            <NvListSection>
              {cityResults.map((result) => (
                <NvListRow
                  key={`${result.latitude},${result.longitude}`}
                  title={result.name}
                  description={result.context}
                  onPress={() => {
                    setCity({
                      name: result.name,
                      latitude: result.latitude,
                      longitude: result.longitude,
                      timezone: result.timezone,
                    });
                    setQuery("");
                    back();
                  }}
                />
              ))}
            </NvListSection>
          )}
          {city && (
            <NvButton variant="quiet" onClick={() => setCity(null)}>
              {t("settings.weatherCityNone")}
            </NvButton>
          )}
        </div>
      )}
    </NvSheet>
  );
};
