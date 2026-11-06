import React, { useEffect, useRef, useState } from "react";
import { useImageViewer } from "@/features";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  InfoIcon,
  MinusIcon,
  NvSegmented,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  getImageThumbnail,
  useI18n,
  type FileItem,
} from "@/shared";
import { MediaThumb } from "./MediaThumb";
import "./photo-viewer.css";

export interface PhotoViewerProps {
  images: FileItem[];
  initialIndex: number;
  totalImageCount: number;
  hasMore: boolean;
  /** Images in the whole collection, for "N / total"; omitted when the list starts mid-library. */
  displayTotal?: number;
  onNeedMore: () => void;
  onClose: () => void;
}

const clampZoom = (value: number) => Math.max(1, Math.min(4, value));
/** Thumbnails either side of the current photo in the filmstrip. */
const STRIP_REACH = 7;
/** Chrome hides after this long without input while the slideshow plays. */
const CHROME_IDLE_MS = 3000;
const INTERVALS = [10, 15, 30] as const;

async function decodeImage(source: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return source;
}

function formatBytes(bytes: number, locale: string): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (bytes >= 1024 ** 3) return `${number.format(bytes / 1024 ** 3)} GB`;
  if (bytes >= 1024 ** 2) return `${number.format(bytes / 1024 ** 2)} MB`;
  return `${number.format(Math.max(1, bytes / 1024))} KB`;
}

function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut > 0 ? path.slice(0, cut) : path;
}

/**
 * The photo viewer (Apple Photos / Google Photos): the photo alone on a
 * dark stage, a quiet top bar (back, name, date, position, info, close), and
 * a bottom bar with the filmstrip and controls. A tap in the middle hides
 * the chrome; taps at the edges step; swipe, pinch, wheel and double-tap
 * zoom. Photos crossfade: the previous one stays until the next is decoded.
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  images,
  initialIndex,
  totalImageCount,
  hasMore,
  displayTotal,
  onNeedMore,
  onClose,
}) => {
  const { t, locale } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState<(typeof INTERVALS)[number]>(10);
  const [fill, setFill] = useState(false);
  const [info, setInfo] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const {
    currentIndex,
    totalCount,
    currentImage,
    nextImage,
    hasPrev,
    hasNext,
    isWaitingForImage,
    goToPrev,
    goToNext,
    goToFirst,
    goToIndex,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useImageViewer({
    images,
    initialIndex,
    onClose,
    totalCount: totalImageCount,
    hasMore,
    isLoadingMore: false,
    loadMoreError: null,
    onNeedMore,
    canSwipe: zoom === 1,
  });

  const [loaded, setLoaded] = useState({ path: "", version: "", full: "", high: "" });
  const [failedPath, setFailedPath] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  // The photo being faded out underneath the new one.
  const [under, setUnder] = useState("");

  const currentKey = currentImage
    ? `${currentImage.path}:${currentImage.modified_ms}:${currentImage.size}`
    : "";
  const [previousKey, setPreviousKey] = useState(currentKey);
  if (currentImage && previousKey !== currentKey) {
    setPreviousKey(currentKey);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFailedPath("");
  }

  const currentPath = currentImage?.path ?? "";
  const nextPath = nextImage?.path ?? "";
  const currentVersion = currentImage ? `${currentImage.modified_ms}:${currentImage.size}` : "";
  const nextVersion = nextImage ? `${nextImage.modified_ms}:${nextImage.size}` : "";
  const pointerStart = useRef({ x: 0, y: 0, time: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStart = useRef({ distance: 0, zoom: 1 });
  const pinched = useRef(false);
  const shownRef = useRef("");

  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Decode the 1600px image (and warm the next one) before showing it.
  useEffect(() => {
    if (!currentPath) return;
    const controller = new AbortController();
    const path = currentPath;
    void getImageThumbnail(path, 1600, 3, controller.signal, currentVersion)
      .then((full) => decodeImage(full, controller.signal))
      .then((full) => {
        if (controller.signal.aborted) return;
        setUnder(shownRef.current);
        shownRef.current = full;
        setLoaded((image) =>
          image.path === path && image.version === currentVersion
            ? { ...image, full }
            : { path, version: currentVersion, full, high: "" },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedPath(path);
      });
    if (nextPath) {
      void getImageThumbnail(nextPath, 1600, 2, controller.signal, nextVersion).catch(
        () => undefined,
      );
    }
    return () => controller.abort();
  }, [currentPath, currentVersion, nextPath, nextVersion, retryVersion]);

  // Zoomed past 1.5×: swap in the 3200px image.
  useEffect(() => {
    if (
      !currentPath ||
      zoom < 1.5 ||
      loaded.high ||
      loaded.path !== currentPath ||
      loaded.version !== currentVersion
    )
      return;
    const controller = new AbortController();
    const path = currentPath;
    void getImageThumbnail(path, 3200, 3, controller.signal, currentVersion)
      .then((high) => decodeImage(high, controller.signal))
      .then((high) => {
        if (!controller.signal.aborted)
          setLoaded((image) =>
            image.path === path && image.version === currentVersion ? { ...image, high } : image,
          );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [currentPath, currentVersion, loaded.high, loaded.path, loaded.version, zoom]);

  // Slideshow: advance once the current photo is on screen.
  useEffect(() => {
    if (!playing || !pageVisible || zoom > 1 || !currentImage || isWaitingForImage) return;
    if (loaded.path !== currentImage.path || loaded.version !== currentVersion || !loaded.full)
      return;
    const timer = window.setTimeout(() => {
      if (currentIndex >= totalCount - 1) goToFirst();
      else goToNext();
    }, intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [
    playing,
    pageVisible,
    zoom,
    currentImage,
    currentVersion,
    isWaitingForImage,
    loaded.path,
    loaded.version,
    loaded.full,
    currentIndex,
    totalCount,
    goToFirst,
    goToNext,
    intervalSeconds,
  ]);

  // While the slideshow plays, the chrome steps aside after a few quiet seconds.
  useEffect(() => {
    if (!playing || !chrome) return;
    const timer = window.setTimeout(() => setChrome(false), CHROME_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [chrome, playing, currentIndex]);

  if (!currentImage) return null;

  const boundedPan = (x: number, y: number, nextZoom: number) => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight || nextZoom <= 1) return { x: 0, y: 0 };
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = image.naturalWidth / image.naturalHeight;
    const baseWidth = fill ? width : Math.min(width, height * ratio);
    const baseHeight = fill ? height : Math.min(height, width / ratio);
    const maxX = Math.max(0, (baseWidth * nextZoom - width) / 2);
    const maxY = Math.max(0, (baseHeight * nextZoom - height) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const changeZoom = (next: number) => {
    const clamped = clampZoom(next);
    setZoom(clamped);
    setPan((previous) => boundedPan(previous.x, previous.y, clamped));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-viewer-control]")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      pinched.current = true;
      handlePointerCancel();
      return;
    }
    pointerStart.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    panStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    if (zoom === 1) handlePointerDown(event);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (pinchStart.current.distance > 0) {
        changeZoom(
          (pinchStart.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
            pinchStart.current.distance,
        );
      }
    } else if (zoom > 1) {
      setPan(
        boundedPan(
          panStart.current.panX + event.clientX - panStart.current.x,
          panStart.current.panY + event.clientY - panStart.current.y,
          zoom,
        ),
      );
    } else {
      handlePointerMove(event);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pinched.current || zoom > 1) {
      handlePointerCancel();
      if (pointers.current.size === 0) pinched.current = false;
      return;
    }
    const deltaX = Math.abs(event.clientX - pointerStart.current.x);
    const deltaY = Math.abs(event.clientY - pointerStart.current.y);
    const elapsed = Date.now() - pointerStart.current.time;
    handlePointerUp();
    if (deltaX >= 10 || deltaY >= 10 || elapsed >= 350) return;
    const ratio = event.clientX / event.currentTarget.clientWidth;
    if (ratio < 0.25) goToPrev();
    else if (ratio > 0.75) goToNext();
    else setChrome((visible) => !visible);
  };

  const source =
    !isWaitingForImage && loaded.path === currentImage.path && loaded.version === currentVersion
      ? (zoom > 1.5 && loaded.high) || loaded.full
      : "";
  const failed = failedPath === currentImage.path;

  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(currentImage.modified_ms);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
    currentImage.modified_ms,
  );
  const position =
    displayTotal !== undefined
      ? t("viewer.position", {
          current: new Intl.NumberFormat(locale).format(currentIndex + 1),
          total: new Intl.NumberFormat(locale).format(displayTotal),
        })
      : "";

  const stripStart = Math.max(0, currentIndex - STRIP_REACH);
  const strip = images.slice(stripStart, Math.min(images.length, currentIndex + STRIP_REACH + 1));

  return (
    <div
      className="pv"
      data-chrome={chrome || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        handlePointerCancel();
        if (pointers.current.size === 0) pinched.current = false;
      }}
      onWheel={(event) => {
        if ((event.target as Element).closest("[data-viewer-control]")) return;
        changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
      }}
      onDoubleClick={(event) => {
        if (!(event.target as Element).closest("[data-viewer-control]"))
          changeZoom(zoom === 1 ? 2 : 1);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("viewer.label", { name: currentImage.name })}
    >
      <div className="pv__stage">
        {under && <img className="pv__photo pv__photo--under" src={under} alt="" />}
        {source && !failed && (
          <img
            key={currentKey}
            ref={imageRef}
            src={source}
            alt={currentImage.name}
            className={`pv__photo${fill ? " pv__photo--fill" : ""}`}
            draggable={false}
            decoding="async"
            onAnimationEnd={() => setUnder("")}
            onError={() => setFailedPath(currentImage.path)}
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
          />
        )}
        {failed && (
          <div className="pv__state" role="alert" data-viewer-control>
            <strong>{t("viewer.cantShow")}</strong>
            <span>{t("viewer.cantShowHint")}</span>
            <button
              type="button"
              className="pv__text-button"
              onClick={() => {
                setFailedPath("");
                setRetryVersion((value) => value + 1);
              }}
            >
              {t("common.retry")}
            </button>
          </div>
        )}
        {!source && !failed && !under && (
          <span className="pv__spinner" role="status" aria-label={t("viewer.loading")} />
        )}
      </div>

      <header className="pv__top" data-viewer-control inert={!chrome}>
        <button
          type="button"
          className="pv__circle"
          onClick={onClose}
          aria-label={t("nav.gallery")}
        >
          <ArrowLeftIcon size={22} />
        </button>
        <div className="pv__title">
          <strong title={currentImage.name}>{currentImage.name}</strong>
          <span>{[date, time, position].filter(Boolean).join(" · ")}</span>
        </div>
        <button
          type="button"
          className="pv__circle"
          aria-pressed={info}
          aria-label={t("viewer.info")}
          title={t("viewer.info")}
          onClick={() => setInfo((value) => !value)}
        >
          <InfoIcon size={22} />
        </button>
        <button
          type="button"
          className="pv__circle"
          onClick={onClose}
          aria-label={t("viewer.close")}
          title={t("viewer.close")}
        >
          <CloseIcon size={22} />
        </button>
      </header>

      <footer className="pv__bottom" data-viewer-control inert={!chrome}>
        <nav className="pv__strip" aria-label={t("viewer.filmstrip")}>
          {strip.map((image, offset) => {
            const index = stripStart + offset;
            return (
              <button
                key={image.path}
                type="button"
                className="pv__frame"
                aria-current={index === currentIndex || undefined}
                aria-label={image.name}
                onClick={() => goToIndex(index)}
              >
                <MediaThumb item={image} size={64} />
              </button>
            );
          })}
        </nav>

        <div className="pv__controls">
          <button
            type="button"
            className="pv__circle"
            onClick={goToPrev}
            disabled={!hasPrev}
            aria-label={t("viewer.prev")}
          >
            <ChevronLeftIcon size={22} />
          </button>
          <button
            type="button"
            className="pv__circle"
            onClick={goToNext}
            disabled={!hasNext}
            aria-label={t("viewer.next")}
          >
            <ChevronRightIcon size={22} />
          </button>

          <span className="pv__rule" aria-hidden="true" />

          <div className="pv__group" role="group" aria-label={t("viewer.zoomReset")}>
            <button
              type="button"
              className="pv__square"
              onClick={() => changeZoom(zoom - 0.5)}
              disabled={zoom <= 1}
              aria-label={t("viewer.zoomOut")}
            >
              <MinusIcon size={18} />
            </button>
            <button
              type="button"
              className="pv__square pv__square--wide"
              onClick={() => changeZoom(1)}
              aria-label={t("viewer.zoomReset")}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="pv__square"
              onClick={() => changeZoom(zoom + 0.5)}
              disabled={zoom >= 4}
              aria-label={t("viewer.zoomIn")}
            >
              <PlusIcon size={18} />
            </button>
          </div>

          <button
            type="button"
            className="pv__square pv__square--wide"
            onClick={() => setFill((value) => !value)}
            aria-label={t("viewer.fitToggle")}
          >
            {fill ? t("viewer.fit") : t("viewer.fill")}
          </button>

          <span className="pv__rule" aria-hidden="true" />

          <button
            type="button"
            className="pv__play"
            aria-pressed={playing}
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? t("viewer.slideshowPause") : t("viewer.slideshowStart")}
          >
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            <span>{playing ? t("viewer.pause") : t("viewer.autoplay")}</span>
          </button>
          <NvSegmented
            label={t("viewer.interval")}
            value={String(intervalSeconds)}
            options={INTERVALS.map((seconds) => ({
              value: String(seconds),
              label: t("viewer.seconds", { count: seconds }),
            }))}
            onChange={(value) => setIntervalSeconds(Number(value) as (typeof INTERVALS)[number])}
            className="pv__interval"
          />
        </div>
      </footer>

      {info && (
        <aside className="pv__info" data-viewer-control aria-label={t("viewer.infoTitle")}>
          <h2>{t("viewer.infoTitle")}</h2>
          <dl>
            <dt>{t("viewer.date")}</dt>
            <dd>
              {date} {time}
            </dd>
            {currentImage.width && currentImage.height ? (
              <>
                <dt>{t("viewer.dimensions")}</dt>
                <dd>
                  {currentImage.width} × {currentImage.height}
                </dd>
              </>
            ) : null}
            <dt>{t("viewer.fileSize")}</dt>
            <dd>{formatBytes(currentImage.size, locale)}</dd>
            <dt>{t("viewer.format")}</dt>
            <dd>{currentImage.extension.toUpperCase()}</dd>
            <dt>{t("viewer.folder")}</dt>
            <dd className="pv__path">{folderOf(currentImage.path)}</dd>
          </dl>
        </aside>
      )}
    </div>
  );
};
