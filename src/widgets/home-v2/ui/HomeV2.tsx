import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CloseIcon,
  FolderIcon,
  GridIcon,
  getBundledBrandAssetUrl,
  ImageIcon,
  MoonIcon,
  NovusLogo,
  NvButton,
  NvCaption,
  NvGlyphButton,
  NvGlyphRail,
  NvMonthCalendar,
  NvServicePlate,
  NvStatus,
  PlayIcon,
  RemoteIcon,
  SearchIcon,
  SettingsIcon,
  ThemeIcon,
  useI18n,
  VolumeIcon,
  type NvSessionState,
  type WeatherCondition,
} from "@/shared";
import "./home-v2.css";

/** Share of the viewport the folded photo keeps as the band on today's page. */
const BAND_RATIO = 0.13;
/** Default wait on today's page before the home returns to the photo frame. */
const AUTO_RETURN_MS = 60_000;
/**
 * Service grid: always two rows. Tiles are as large as the height left on
 * today's page allows; the column count follows from that and the width.
 */
const TILE_ROWS = 2;
const MIN_TILE_COLS = 4;
const MAX_TILE_COLS = 9;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export interface HomeService {
  id: string;
  name: string;
  state: NvSessionState;
  lastUsed?: number;
}

export interface HomeLocation {
  label: string;
  path: string;
  kind: "downloads" | "drive";
}

export interface HomeV2Props {
  now: Date;
  photoUrl: string;
  /** Vertical focal point of the photo (0–1); the folded band shows this strip. */
  photoFocus?: number;
  /** Marks the photo as sample material (style guide only). */
  sampleLabel?: string;
  weather?: { city: string; condition: WeatherCondition; temperature: number } | null;
  services: HomeService[];
  /** Locations for the explorer row (Downloads, drives). */
  locations: HomeLocation[];
  ambient: boolean;
  error?: string;
  onOpenService: (id: string) => void;
  onEndSession: (id: string) => void;
  onOpenGallery: () => void;
  onOpenFinder: (path?: string) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenCalendar: () => void;
  onOpenRadio: () => void;
  onOpenRemote: () => void;
  onEnterAmbient: () => void;
  onWake: () => void;
  onToggleTheme: () => void;
  /** Suspends number-key shortcuts while an overlay owns the keyboard. */
  shortcutsEnabled?: boolean;
  /** Which frame to show on mount: the photo, or today's page (coming back from an app). */
  entry?: "photo" | "today";
  /** Idle time on today's page before scrolling back to the photo frame; 0 disables. */
  autoReturnMs?: number;
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000) + 1;
}

/** ISO-8601 week number. */
function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return "home.greeting.morning" as const;
  if (hour >= 12 && hour < 18) return "home.greeting.afternoon" as const;
  if (hour >= 18 && hour < 23) return "home.greeting.evening" as const;
  return "home.greeting.night" as const;
}

/**
 * Novus v2 home. Frame one: what you were doing, full-bleed over today's
 * photo. Frame two: today's page under the folded photo band. Left alone,
 * frame one becomes the ambient photo frame.
 */
export const HomeV2: React.FC<HomeV2Props> = ({
  now,
  photoUrl,
  photoFocus = 0.5,
  sampleLabel,
  weather,
  services,
  locations,
  ambient,
  error,
  onOpenService,
  onEndSession,
  onOpenGallery,
  onOpenFinder,
  onOpenSettings,
  onOpenSearch,
  onOpenCalendar,
  onOpenRadio,
  onOpenRemote,
  onEnterAmbient,
  onWake,
  onToggleTheme,
  shortcutsEnabled = true,
  entry = "photo",
  autoReturnMs = AUTO_RETURN_MS,
}) => {
  const { t, locale, relativeTime, time } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const tilesRef = useRef<HTMLDivElement>(null);
  const [tileCols, setTileCols] = useState(6);
  const focusRef = useRef(photoFocus);
  useEffect(() => {
    focusRef.current = photoFocus;
  }, [photoFocus]);

  const live = services
    .filter((service) => service.state === "live")
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));
  const featured =
    live[0] ??
    [...services]
      .filter((service) => service.lastUsed)
      .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))[0];
  const featuredIsLive = featured?.state === "live";

  // ---------- Photo double buffer: decode the next photo, then crossfade ----------
  const [layers, setLayers] = useState<{ a: string; b: string; front: "a" | "b" }>(() => ({
    a: photoUrl,
    b: "",
    front: "a",
  }));
  const frontUrl = layers[layers.front];
  useEffect(() => {
    if (!photoUrl || photoUrl === frontUrl) return;
    let cancelled = false;
    const next = new Image();
    next.src = photoUrl;
    next
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        setLayers((prev) => {
          const back = prev.front === "a" ? "b" : "a";
          return { ...prev, [back]: photoUrl, front: back };
        });
      });
    return () => {
      cancelled = true;
    };
  }, [photoUrl, frontUrl]);

  // ---------- Photo fold: one transformed element tracks the scroll ----------
  const applyFold = useCallback(() => {
    frameRef.current = 0;
    const scroller = scrollerRef.current;
    const photo = photoRef.current;
    if (!scroller || !photo) return;
    const height = scroller.clientHeight;
    const progress = height ? Math.min(1, scroller.scrollTop / height) : 0;
    // Folded, the band is centred on the photo's focal strip, not its bottom edge.
    const band = height * BAND_RATIO;
    const travel = Math.min(height - band, Math.max(0, focusRef.current * height - band / 2));
    photo.style.transform = `translate3d(0, ${-progress * travel}px, 0)`;
  }, []);

  const onScroll = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(applyFold);
  }, [applyFold]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => {
      // The band keeps a fixed share of the frame; percentages cannot express it
      // because today's page grows with its content.
      const host = scroller.parentElement;
      host?.style.setProperty("--nvh-band", `${Math.round(scroller.clientHeight * BAND_RATIO)}px`);
      // Today's page caps its largest elements by the frame height so it fits one screen.
      host?.style.setProperty("--nvh-h", `${scroller.clientHeight}px`);
      applyFold();
    });
    observer.observe(scroller);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [applyFold]);

  // Largest tiles that fit two rows in the height left over; unused cells are reserved slots.
  useEffect(() => {
    const tiles = tilesRef.current;
    const grid = tiles?.closest<HTMLElement>(".nvt");
    if (!tiles || !grid) return;
    const measure = () => {
      const gridStyle = getComputedStyle(grid);
      const tileStyle = getComputedStyle(tiles);
      const rowGap = parseFloat(gridStyle.rowGap) || 0;
      const colGap = parseFloat(tileStyle.columnGap) || 0;
      const tileRowGap = parseFloat(tileStyle.rowGap) || 0;
      const height = (selector: string) =>
        grid.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0;
      const used =
        (parseFloat(gridStyle.paddingTop) || 0) +
        (parseFloat(gridStyle.paddingBottom) || 0) +
        Math.max(height(".nvt__glance"), height(".nvt__calendar")) +
        height(".nvt__services .nvt__row-head") +
        height(".nvt__files") +
        rowGap * 2 +
        tileRowGap;
      const label = height(".nvt__tiles .nv-plate__bar") || 32;
      const rowHeight = (grid.clientHeight - used) / TILE_ROWS;
      const tileWidth = Math.max(80, ((rowHeight - label) * 16) / 9);
      const cols = Math.ceil((tiles.clientWidth + colGap) / (tileWidth + colGap));
      setTileCols(Math.min(MAX_TILE_COLS, Math.max(MIN_TILE_COLS, cols)));
    };
    // The frame is fixed, but fonts and the calendar settle after first paint.
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid
      .querySelectorAll<HTMLElement>(".nvt__glance, .nvt__calendar, .nvt__files")
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  // Ambient always shows the first frame.
  useEffect(() => {
    if (ambient) scrollerRef.current?.scrollTo({ top: 0 });
  }, [ambient]);

  // Coming back from an app lands on today's page, already folded.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (entry !== "today" || !scroller) return;
    scroller.scrollTop = scroller.clientHeight;
    applyFold();
    // Only on mount: later scrolling belongs to the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Left alone on today's page, the home returns to the photo frame.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || ambient || !shortcutsEnabled || autoReturnMs <= 0) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (scroller.scrollTop >= scroller.clientHeight / 2) {
          const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          scroller.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        }
      }, autoReturnMs);
    };
    arm();
    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, arm, { passive: true, capture: true }),
    );
    scroller.addEventListener("scroll", arm, { passive: true });
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, arm, { capture: true }));
      scroller.removeEventListener("scroll", arm);
    };
  }, [ambient, shortcutsEnabled, autoReturnMs]);

  // ---------- Number keys 1–N open services ----------
  useEffect(() => {
    if (!shortcutsEnabled || ambient) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true'], .nv-overlay")) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < services.length) {
        event.preventDefault();
        onOpenService(services[index].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [services, onOpenService, shortcutsEnabled, ambient]);

  const scrollBehavior = (): ScrollBehavior =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const goToday = () => {
    const scroller = scrollerRef.current;
    scroller?.scrollTo({ top: scroller.clientHeight, behavior: scrollBehavior() });
  };
  const goTop = () => scrollerRef.current?.scrollTo({ top: 0, behavior: scrollBehavior() });

  const dateLine = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const monthLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(
    now,
  );
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now);
  const weatherLine = weather
    ? t("home.weather", {
        city: weather.city,
        condition: t(`weather.${weather.condition}`),
        temperature: Math.round(weather.temperature),
      })
    : null;
  const liveCount = live.length;

  // ---------- Caption content per state ----------
  let caption: React.ReactNode;
  if (featured && featuredIsLive) {
    const used = featured.lastUsed ? ` · ${relativeTime(featured.lastUsed)}` : "";
    caption = (
      <NvCaption
        status={
          <NvStatus tone="live" onMedia>
            {t("home.live")}
            {used}
          </NvStatus>
        }
        title={featured.name}
        subtitle={t("home.pressToResume")}
        actions={
          <NvButton
            variant="primary"
            size="large"
            onMedia
            icon={<PlayIcon />}
            data-nav-default
            onClick={() => onOpenService(featured.id)}
          >
            {t("home.resume")}
          </NvButton>
        }
      />
    );
  } else if (featured) {
    caption = (
      <NvCaption
        status={
          <NvStatus tone="neutral" onMedia>
            {t("home.lastUsed")} · {relativeTime(featured.lastUsed ?? now.getTime())}
          </NvStatus>
        }
        title={featured.name}
        subtitle={t("home.sessionEnded")}
        actions={
          <NvButton
            variant="primary"
            size="large"
            onMedia
            icon={<PlayIcon />}
            data-nav-default
            onClick={() => onOpenService(featured.id)}
          >
            {t("home.openService", { name: featured.name })}
          </NvButton>
        }
      />
    );
  } else {
    caption = <NvCaption title={t(greetingKey(now.getHours()))} subtitle={t("home.idleHint")} />;
  }

  return (
    <div className={`nvh${ambient ? " is-ambient" : ""}`}>
      <div
        ref={photoRef}
        className="nvh__photo"
        aria-hidden="true"
        data-crossfade={layers.b ? "" : undefined}
      >
        {(["a", "b"] as const).map((key) =>
          layers[key] ? (
            <img
              key={key}
              src={layers[key]}
              alt=""
              draggable={false}
              decoding="async"
              data-front={layers.front === key ? "" : undefined}
              onLoad={(event) => {
                event.currentTarget.dataset.loaded = "";
              }}
            />
          ) : null,
        )}
      </div>

      <div ref={scrollerRef} className="nvh__scroller" onScroll={onScroll}>
        {/* ---------- Frame 1 ---------- */}
        <section className="nvh__frame nvh__frame--hero nv-on-media" aria-label={t("home.resume")}>
          <div className="nvh__scrim" aria-hidden="true" />
          <header className="nvh__bar">
            <span className="nvh__fade">
              <NovusLogo height="calc(30px * var(--nv-scale))" />
            </span>
            <span className="nvh__clock">
              <span className="nv-numeral nvh__time">{time(now)}</span>
              <span className="nvh__date">
                {dateLine}
                {weatherLine && ` · ${weatherLine}`}
              </span>
            </span>
          </header>
          {sampleLabel && <span className="nvh__sample">{sampleLabel}</span>}

          <div className="nvh__caption nvh__fade">
            {caption}
            {live.length > 0 && (
              <div className="nvh__tray" role="group" aria-label={t("running.label")}>
                <span className="nvh__tray-label">
                  {t("running.count", { count: live.length })}
                </span>
                {live.map((service) => {
                  const art = getBundledBrandAssetUrl(service.id);
                  return (
                    <span key={service.id} className="nvh__chip">
                      <button
                        type="button"
                        className="nvh__chip-open"
                        onClick={() => onOpenService(service.id)}
                        aria-label={t("running.background", { name: service.name })}
                      >
                        {art && <img src={art} alt="" className="nvh__chip-art" />}
                        <span>{service.name}</span>
                      </button>
                      <button
                        type="button"
                        className="nvh__chip-close"
                        onClick={() => onEndSession(service.id)}
                        aria-label={t("running.close", { name: service.name })}
                      >
                        <CloseIcon size={16} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <NvGlyphRail label={t("nav.globalActions")} className="nvh__rail nvh__fade">
            <NvGlyphButton
              onMedia
              icon={<SearchIcon />}
              label={t("common.search")}
              onClick={onOpenSearch}
            />
            <NvGlyphButton
              onMedia
              icon={<ImageIcon />}
              label={t("nav.gallery")}
              onClick={onOpenGallery}
            />
            <NvGlyphButton
              onMedia
              icon={<FolderIcon />}
              label={t("nav.files")}
              onClick={() => onOpenFinder()}
            />
            <NvGlyphButton
              onMedia
              icon={<RemoteIcon />}
              label={t("nav.remote")}
              hint={t("home.soon")}
              muted
              onClick={onOpenRemote}
            />
            <NvGlyphButton
              onMedia
              icon={<SettingsIcon />}
              label={t("common.settings")}
              onClick={onOpenSettings}
            />
          </NvGlyphRail>

          <button type="button" className="nvh__hint nvh__fade" onClick={goToday}>
            {t("home.todayHint")}
            <span aria-hidden="true" className="nvh__chev" />
          </button>
        </section>

        {/* ---------- Frame 2: today's page ---------- */}
        <section className="nvh__frame nvh__frame--today" aria-label={t("home.today")}>
          <div className="nvh__band nv-on-media">
            <button type="button" className="nvh__hint nvh__hint--up" onClick={goTop}>
              <span aria-hidden="true" className="nvh__chev nvh__chev--up" />
              {t("home.photoHint")}
            </button>
            <NovusLogo height="calc(30px * var(--nv-scale))" className="nvh__band-logo" />
            <span className="nvh__spacer" />
            <NvGlyphButton
              onMedia
              showLabel={false}
              icon={<SearchIcon />}
              label={t("common.search")}
              onClick={onOpenSearch}
            />
            <NvGlyphButton
              onMedia
              showLabel={false}
              icon={<ThemeIcon />}
              label={t("nav.theme")}
              onClick={onToggleTheme}
            />
            <NvGlyphButton
              onMedia
              showLabel={false}
              icon={<SettingsIcon />}
              label={t("common.settings")}
              onClick={onOpenSettings}
            />
          </div>

          <div className="nvt">
            {/* Row 1: today (date | time) beside this month */}
            <div className="nvt__glance">
              <div className="nvt__date">
                <span className="nv-numeral nvt__numeral">{now.getDate()}</span>
                <span className="nvt__date-side">
                  <span className="nvt__weekday">{weekday}</span>
                  <span className="nvt__month">{monthLabel}</span>
                  <span className="nvt__dayline">
                    {t("home.dayOfYear", { day: dayOfYear(now), week: isoWeek(now) })}
                  </span>
                </span>
              </div>
              <div className="nvt__now">
                <span className="nv-numeral nvt__time">{time(now)}</span>
                {weatherLine && <span className="nvt__weather">{weatherLine}</span>}
              </div>
            </div>

            <div className="nvt__calendar">
              <div className="nvt__row-head">
                <h3 className="nvt__heading">{t("home.thisMonth")}</h3>
                <button type="button" className="nvt__link" onClick={onOpenCalendar}>
                  {t("home.openCalendar")}
                </button>
              </div>
              <NvMonthCalendar date={now} locale={locale} />
            </div>

            {/* Row 2: services, full width, two rows with room for more */}
            <div className="nvt__services">
              <div className="nvt__row-head">
                <h3 className="nvt__heading">{t("home.services")}</h3>
                <span className="nvt__hint">
                  {liveCount > 0
                    ? t("home.servicesHint", { count: liveCount, max: services.length })
                    : t("home.servicesHintIdle", { max: services.length })}
                </span>
              </div>
              <div
                ref={tilesRef}
                className="nvt__tiles"
                style={{ gridTemplateColumns: `repeat(${tileCols}, minmax(0, 1fr))` }}
              >
                {services.map((service, index) => (
                  <NvServicePlate
                    key={service.id}
                    id={service.id}
                    name={service.name}
                    shortcut={index + 1}
                    state={service.state}
                    liveLabel={t("home.live")}
                    endedLabel={t("home.ended")}
                    onPress={() => onOpenService(service.id)}
                    onClose={service.state === "live" ? () => onEndSession(service.id) : undefined}
                    closeLabel={t("running.close", { name: service.name })}
                  />
                ))}
                <button type="button" className="nvt__all-apps" onClick={onOpenSearch}>
                  <span className="nvt__all-apps-field">
                    <GridIcon />
                  </span>
                  <span className="nvt__all-apps-bar">{t("home.allApps")}</span>
                </button>
                {Array.from(
                  { length: Math.max(0, tileCols * TILE_ROWS - services.length - 1) },
                  (_, k) => (
                    <span key={`slot-${k}`} className="nvt__slot" aria-hidden="true" />
                  ),
                )}
              </div>
              {error && (
                <p className="nvh__error" role="alert">
                  <NvStatus tone="attention">{error}</NvStatus>
                </p>
              )}
            </div>

            {/* Row 3: the explorer row */}
            <nav className="nvt__files" aria-label={t("home.explorer")}>
              <span className="nvt__files-title">{t("home.explorer")}</span>
              <NvButton icon={<ImageIcon />} onClick={onOpenGallery}>
                {t("nav.gallery")}
              </NvButton>
              {locations.map((location) => (
                <NvButton
                  key={location.path}
                  icon={<FolderIcon />}
                  onClick={() => onOpenFinder(location.path)}
                >
                  {location.label}
                </NvButton>
              ))}
              <NvButton icon={<FolderIcon />} onClick={() => onOpenFinder()}>
                {t("nav.files")}
              </NvButton>
              <NvButton icon={<VolumeIcon />} onClick={onOpenRadio}>
                {t("home.radio")}
              </NvButton>
              <span className="nvh__spacer" />
              <NvButton variant="quiet" icon={<MoonIcon />} onClick={onEnterAmbient}>
                {t("home.ambient")}
              </NvButton>
              <NvButton variant="quiet" icon={<RemoteIcon />} onClick={onOpenRemote}>
                {t("home.mobileRemote")}
                <span className="nvh__soon">{t("home.soon")}</span>
              </NvButton>
            </nav>
          </div>
        </section>
      </div>

      {ambient && (
        <button
          type="button"
          className="nvh__wake"
          aria-label={t("home.ambientExit")}
          onPointerDown={(event) => {
            event.preventDefault();
            onWake();
          }}
          onKeyDown={(event) => {
            event.preventDefault();
            onWake();
          }}
          autoFocus
        >
          <span className="nvh__wake-hint">{t("home.ambientExit")}</span>
        </button>
      )}
    </div>
  );
};
