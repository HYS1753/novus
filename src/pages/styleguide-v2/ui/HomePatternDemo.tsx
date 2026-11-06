import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderIcon,
  getAmbientArtworkForDay,
  ImageIcon,
  MoonIcon,
  NovusLogo,
  NvButton,
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
  useNow,
  useI18n,
  VolumeIcon,
} from "@/shared";

const FRAME_W = 1368;
const FRAME_H = 912;
/** Height of the photo band left on today's page after the fold. */
const BAND_H = 176;

const SERVICES = [
  { id: "netflix", name: "Netflix", live: true },
  { id: "youtube", name: "YouTube", live: true },
  { id: "disney", name: "Disney+" },
  { id: "tving", name: "TVING" },
  { id: "wavve", name: "Wavve" },
  { id: "watcha", name: "Watcha" },
  { id: "coupang", name: "Coupang Play" },
];
/** Sample: Netflix was last on screen 12 minutes before the guide opened. */
const SAMPLE_LAST_USED = Date.now() - 12 * 60_000;

/**
 * The v2 home pattern at the reference device size (Surface Pro 4, 1368×912),
 * scaled to fit the guide. Frame one: what you were doing, full-bleed over
 * today's photo. Frame two: today's page. The photo folds into the band as
 * you scroll — one transformed element, nothing else animates.
 */
export const HomePatternDemo: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef(0);
  const [scale, setScale] = useState(0.5);
  const today = useNow();
  const { t, locale, relativeTime, time: formatTime } = useI18n();
  const time = formatTime(today);
  const artwork = getAmbientArtworkForDay(today);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / FRAME_W));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const scroller = scrollerRef.current;
      const photo = photoRef.current;
      if (!scroller || !photo) return;
      const progress = Math.min(1, scroller.scrollTop / FRAME_H);
      photo.style.transform = `translate3d(0, ${-progress * (FRAME_H - BAND_H)}px, 0)`;
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const goTo = (frame: 0 | 1) =>
    scrollerRef.current?.scrollTo({ top: frame * FRAME_H, behavior: "smooth" });

  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(today);
  const monthLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(
    today,
  );
  const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(today);

  return (
    <div ref={wrapRef} className="sg2-demo" style={{ height: FRAME_H * scale }}>
      <div
        className="nvh"
        style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})` }}
      >
        {artwork && (
          <img ref={photoRef} className="nvh__photo" src={artwork.url} alt="" draggable={false} />
        )}

        <div ref={scrollerRef} className="nvh__scroller" onScroll={onScroll}>
          {/* Frame 1 — one thing, full frame */}
          <section
            className="nvh__frame nvh__frame--hero nv-on-media"
            aria-label={t("home.resume")}
          >
            <div className="nvh__scrim" aria-hidden="true" />
            <header className="nvh__bar">
              <NovusLogo height={28} />
              <span className="nvh__clock">
                <span className="nv-numeral nvh__time">{time}</span>
                <span className="nvh__date">{dateLabel} · Seoul 12°</span>
              </span>
            </header>

            <div className="nvh__caption">
              <NvStatus tone="live" onMedia>
                {t("home.live")} · {t("home.sessionKept")} ·{" "}
                {t("home.usedAgo", { time: relativeTime(SAMPLE_LAST_USED) })}
              </NvStatus>
              <h3 className="nvh__title">Netflix</h3>
              <p className="nvh__sub">
                {t("home.alsoRunning", { names: "YouTube" })} · {t("home.pressToResume")}
              </p>
              <div className="nvh__actions">
                <NvButton variant="primary" size="large" onMedia icon={<PlayIcon />}>
                  {t("home.resume")}
                </NvButton>
                <NvButton size="large" onMedia>
                  {t("home.openService", { name: "YouTube" })}
                </NvButton>
                <NvButton size="large" onMedia>
                  {t("home.endSession")}
                </NvButton>
              </div>
            </div>

            <NvGlyphRail label={t("nav.globalActions")} className="nvh__rail">
              <NvGlyphButton onMedia icon={<SearchIcon />} label={t("common.search")} />
              <NvGlyphButton onMedia icon={<ImageIcon />} label={t("nav.gallery")} />
              <NvGlyphButton onMedia icon={<FolderIcon />} label={t("nav.files")} />
              <NvGlyphButton onMedia icon={<RemoteIcon />} label={t("nav.remote")} />
              <NvGlyphButton onMedia icon={<SettingsIcon />} label={t("common.settings")} />
            </NvGlyphRail>

            <button type="button" className="nvh__hint" onClick={() => goTo(1)}>
              {t("home.todayHint")}
              <span aria-hidden="true" className="nvh__chev" />
            </button>
          </section>

          {/* Frame 2 — today's page under the folded photo band */}
          <section className="nvh__frame nvh__frame--today" aria-label={t("home.today")}>
            <div className="nvh__band nv-on-media">
              <NvGlyphButton
                onMedia
                showLabel={false}
                icon={<SearchIcon />}
                label={t("common.search")}
              />
              <NvGlyphButton
                onMedia
                showLabel={false}
                icon={<ThemeIcon />}
                label={t("nav.theme")}
              />
              <NvGlyphButton
                onMedia
                showLabel={false}
                icon={<SettingsIcon />}
                label={t("common.settings")}
              />
            </div>

            <div className="nvh__sheet">
              <div className="nvh__day">
                <span className="nvh__month">{monthLabel}</span>
                <span className="nv-numeral nvh__numeral">{today.getDate()}</span>
                <span className="nvh__weekday">{weekdayLabel}</span>
                <span className="nvh__meta">
                  <span className="nv-numeral nvh__daytime">{time}</span>
                  <span>Seoul · 12°</span>
                </span>
              </div>

              <div className="nvh__cal">
                <div className="nvh__cal-head">
                  <span>{t("home.thisMonth")}</span>
                  <NvButton variant="quiet">{t("home.openCalendar")}</NvButton>
                </div>
                <NvMonthCalendar date={today} locale={locale} />
              </div>

              <div className="nvh__services">
                <div className="nvh__label">
                  <h4>{t("home.services")}</h4>
                  <span>{t("home.servicesHint", { count: 2, max: SERVICES.length })}</span>
                </div>
                <div className="nvh__plates">
                  {SERVICES.map((service, index) => (
                    <NvServicePlate
                      key={service.id}
                      id={service.id}
                      name={service.name}
                      shortcut={index + 1}
                      state={service.live ? "live" : "idle"}
                      liveLabel={t("home.live")}
                      endedLabel={t("home.ended")}
                    />
                  ))}
                </div>
              </div>

              <nav className="nvh__files" aria-label={t("home.explorer")}>
                <span className="nvh__files-title">{t("home.explorer")}</span>
                <NvButton icon={<ImageIcon />}>{t("nav.gallery")}</NvButton>
                <NvButton icon={<FolderIcon />}>{t("home.downloads")}</NvButton>
                <NvButton icon={<FolderIcon />}>C:\</NvButton>
                <NvButton icon={<FolderIcon />}>D:\</NvButton>
                <NvButton icon={<SearchIcon />}>{t("common.search")}</NvButton>
                <NvButton icon={<VolumeIcon />}>{t("home.radio")}</NvButton>
                <span className="nvh__spacer" />
                <NvButton variant="quiet" icon={<MoonIcon />}>
                  {t("home.ambient")}
                </NvButton>
                <NvButton variant="quiet" icon={<RemoteIcon />}>
                  {t("home.mobileRemote")}
                </NvButton>
              </nav>
            </div>
          </section>
        </div>
        <span className="nvh__sample">예시 데이터</span>
      </div>
    </div>
  );
};
