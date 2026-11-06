import React, { useCallback, useEffect, useRef } from "react";
import {
  FolderIcon,
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
const BAND_RATIO = 0.193;

export interface HomeService {
  id: string;
  name: string;
  state: NvSessionState;
  lastUsed?: number;
}

export interface HomeLocation {
  label: string;
  path: string;
}

export interface HomeV2Props {
  now: Date;
  photoUrl: string;
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
}) => {
  const { t, locale, relativeTime, time, list } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef(0);

  const live = services
    .filter((service) => service.state === "live")
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));
  const featured =
    live[0] ??
    [...services]
      .filter((service) => service.lastUsed)
      .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))[0];
  const featuredIsLive = featured?.state === "live";
  const others = live.slice(1);

  // ---------- Photo fold: one transformed element tracks the scroll ----------
  const applyFold = useCallback(() => {
    frameRef.current = 0;
    const scroller = scrollerRef.current;
    const photo = photoRef.current;
    if (!scroller || !photo) return;
    const height = scroller.clientHeight;
    const progress = height ? Math.min(1, scroller.scrollTop / height) : 0;
    photo.style.transform = `translate3d(0, ${-progress * height * (1 - BAND_RATIO)}px, 0)`;
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
      scroller.parentElement?.style.setProperty(
        "--nvh-band",
        `${Math.round(scroller.clientHeight * BAND_RATIO)}px`,
      );
      applyFold();
    });
    observer.observe(scroller);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [applyFold]);

  // Ambient always shows the first frame.
  useEffect(() => {
    if (ambient) scrollerRef.current?.scrollTo({ top: 0 });
  }, [ambient]);

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

  const goToday = () => {
    const scroller = scrollerRef.current;
    scroller?.scrollTo({ top: scroller.clientHeight, behavior: "smooth" });
  };
  const goTop = () => scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });

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
    const used = featured.lastUsed
      ? ` · ${t("home.usedAgo", { time: relativeTime(featured.lastUsed) })}`
      : "";
    caption = (
      <NvCaption
        status={
          <NvStatus tone="live" onMedia>
            {t("home.live")} · {t("home.sessionKept")}
            {used}
          </NvStatus>
        }
        title={featured.name}
        subtitle={
          others.length > 0
            ? `${t("home.alsoRunning", { names: list(others.map((s) => s.name)) })} · ${t("home.pressToResume")}`
            : t("home.pressToResume")
        }
        actions={
          <>
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
            {others[0] && (
              <NvButton size="large" onMedia onClick={() => onOpenService(others[0].id)}>
                {t("home.openService", { name: others[0].name })}
              </NvButton>
            )}
            <NvButton size="large" onMedia onClick={() => onEndSession(featured.id)}>
              {t("home.endSession")}
            </NvButton>
          </>
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
        subtitle={t("home.idleHint")}
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
      <img
        ref={photoRef}
        className="nvh__photo"
        src={photoUrl || undefined}
        alt=""
        draggable={false}
        decoding="async"
      />

      <div ref={scrollerRef} className="nvh__scroller" onScroll={onScroll}>
        {/* ---------- Frame 1 ---------- */}
        <section className="nvh__frame nvh__frame--hero nv-on-media" aria-label={t("home.resume")}>
          <div className="nvh__scrim" aria-hidden="true" />
          <header className="nvh__bar">
            <span className="nvh__fade">
              <NovusLogo height={28} />
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

          <div className="nvh__caption nvh__fade">{caption}</div>

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

        {/* ---------- Frame 2 ---------- */}
        <section className="nvh__frame nvh__frame--today" aria-label={t("home.today")}>
          <div className="nvh__band nv-on-media">
            <NvGlyphButton
              onMedia
              showLabel={false}
              icon={<span className="nvh__up" aria-hidden="true" />}
              label={t("home.backToTop")}
              onClick={goTop}
            />
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

          <div className="nvh__sheet">
            <div className="nvh__day">
              <span className="nvh__month">{monthLabel}</span>
              <span className="nv-numeral nvh__numeral">{now.getDate()}</span>
              <span className="nvh__weekday">{weekday}</span>
              <span className="nvh__meta">
                <span className="nv-numeral nvh__daytime">{time(now)}</span>
                {weatherLine && <span>{weatherLine}</span>}
              </span>
            </div>

            <div className="nvh__cal">
              <div className="nvh__cal-head">
                <span>{t("home.thisMonth")}</span>
                <NvButton variant="quiet" onClick={onOpenCalendar}>
                  {t("home.openCalendar")}
                </NvButton>
              </div>
              <NvMonthCalendar date={now} locale={locale} />
            </div>

            <div className="nvh__services">
              <div className="nvh__label">
                <h3>{t("home.services")}</h3>
                <span>
                  {liveCount > 0
                    ? t("home.servicesHint", { count: liveCount, max: services.length })
                    : t("home.servicesHintIdle", { max: services.length })}
                </span>
              </div>
              <div className="nvh__plates">
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
                  />
                ))}
              </div>
              {error && (
                <p className="nvh__error" role="alert">
                  <NvStatus tone="attention">{error}</NvStatus>
                </p>
              )}
            </div>

            <nav className="nvh__files" aria-label={t("home.explorer")}>
              <span className="nvh__files-title">{t("home.explorer")}</span>
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
              <NvButton icon={<VolumeIcon />} onClick={onOpenRadio}>
                {t("home.radio")}
              </NvButton>
              <span className="nvh__spacer" />
              <NvButton variant="quiet" icon={<MoonIcon />} onClick={onEnterAmbient}>
                {t("home.ambient")}
              </NvButton>
              <NvButton variant="quiet" icon={<RemoteIcon />} onClick={onOpenRemote}>
                {t("home.mobileRemote")}
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
