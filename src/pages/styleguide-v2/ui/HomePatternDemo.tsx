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
  useCurrentTime,
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
  { id: "tving", name: "티빙" },
  { id: "wavve", name: "웨이브" },
  { id: "watcha", name: "왓챠" },
  { id: "coupang", name: "쿠팡플레이" },
];

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
  const { time } = useCurrentTime();
  const today = new Date();
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

  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(today);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(
    today,
  );
  const weekdayLabel = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(today);

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
          <section className="nvh__frame nvh__frame--hero nv-on-media" aria-label="이어서 보기">
            <div className="nvh__scrim" aria-hidden="true" />
            <header className="nvh__bar">
              <NovusLogo height={28} />
              <span className="nvh__clock">
                <span className="nv-numeral nvh__time">{time}</span>
                <span className="nvh__date">{dateLabel} · 서울 맑음 12°</span>
              </span>
            </header>

            <div className="nvh__caption">
              <NvStatus tone="live" onMedia>
                실행 중 · 세션 유지 · 12분 전 사용
              </NvStatus>
              <h3 className="nvh__title">Netflix</h3>
              <p className="nvh__sub">YouTube도 실행 중 · 확인 키로 바로 복귀</p>
              <div className="nvh__actions">
                <NvButton variant="primary" size="large" onMedia icon={<PlayIcon />}>
                  이어서 보기
                </NvButton>
                <NvButton size="large" onMedia>
                  YouTube로 복귀
                </NvButton>
                <NvButton size="large" onMedia>
                  세션 종료
                </NvButton>
              </div>
            </div>

            <NvGlyphRail label="전역 동작" className="nvh__rail">
              <NvGlyphButton onMedia icon={<SearchIcon />} label="검색" />
              <NvGlyphButton onMedia icon={<ImageIcon />} label="갤러리" />
              <NvGlyphButton onMedia icon={<FolderIcon />} label="파일" />
              <NvGlyphButton onMedia icon={<RemoteIcon />} label="리모컨" />
              <NvGlyphButton onMedia icon={<SettingsIcon />} label="설정" />
            </NvGlyphRail>

            <button type="button" className="nvh__hint" onClick={() => goTo(1)}>
              오늘 · 서비스
              <span aria-hidden="true" className="nvh__chev" />
            </button>
          </section>

          {/* Frame 2 — today's page under the folded photo band */}
          <section className="nvh__frame nvh__frame--today" aria-label="오늘">
            <div className="nvh__band nv-on-media">
              <NvGlyphButton onMedia showLabel={false} icon={<SearchIcon />} label="검색" />
              <NvGlyphButton onMedia showLabel={false} icon={<ThemeIcon />} label="테마" />
              <NvGlyphButton onMedia showLabel={false} icon={<SettingsIcon />} label="설정" />
            </div>

            <div className="nvh__sheet">
              <div className="nvh__day">
                <span className="nvh__month">{monthLabel}</span>
                <span className="nv-numeral nvh__numeral">{today.getDate()}</span>
                <span className="nvh__weekday">{weekdayLabel}</span>
                <span className="nvh__meta">
                  <span className="nv-numeral nvh__daytime">{time}</span>
                  <span>서울 · 맑음 12°</span>
                </span>
              </div>

              <div className="nvh__cal">
                <div className="nvh__cal-head">
                  <span>이번 달</span>
                  <NvButton variant="quiet">Google 캘린더 열기</NvButton>
                </div>
                <NvMonthCalendar date={today} locale="ko-KR" />
              </div>

              <div className="nvh__services">
                <div className="nvh__label">
                  <h4>서비스</h4>
                  <span>실행 중 2 · 숫자키 1–7로 바로 열기</span>
                </div>
                <div className="nvh__plates">
                  {SERVICES.map((service, index) => (
                    <NvServicePlate
                      key={service.id}
                      id={service.id}
                      name={service.name}
                      shortcut={index + 1}
                      state={service.live ? "live" : "idle"}
                    />
                  ))}
                </div>
              </div>

              <nav className="nvh__files" aria-label="탐색기">
                <span className="nvh__files-title">탐색기</span>
                <NvButton icon={<ImageIcon />}>갤러리</NvButton>
                <NvButton icon={<FolderIcon />}>다운로드</NvButton>
                <NvButton icon={<FolderIcon />}>C:\</NvButton>
                <NvButton icon={<FolderIcon />}>D:\</NvButton>
                <NvButton icon={<SearchIcon />}>검색</NvButton>
                <NvButton icon={<VolumeIcon />}>라디오</NvButton>
                <span className="nvh__spacer" />
                <NvButton variant="quiet" icon={<MoonIcon />}>
                  앰비언트
                </NvButton>
                <NvButton variant="quiet" icon={<RemoteIcon />}>
                  모바일 리모컨
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
