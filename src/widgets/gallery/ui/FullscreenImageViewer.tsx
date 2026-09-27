import React, { useEffect, useRef, useState } from "react";
import type { FileItem } from "@/entities";
import { useImageViewer } from "@/features";
import { ArrowLeftIcon, CloseIcon, MotionIcon, getImageThumbnail } from "@/shared";

interface FullscreenImageViewerProps {
  images: FileItem[];
  initialIndex: number;
  totalImageCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  onNeedMore: () => void;
  onClose: () => void;
}

const clampZoom = (value: number) => Math.max(1, Math.min(4, value));

export const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({
  images,
  initialIndex,
  totalImageCount,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onNeedMore,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [fill, setFill] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const {
    currentIndex,
    totalCount,
    currentImage,
    nextImage,
    hasPrev,
    hasNext,
    isWaitingForImage,
    dragOffset,
    isDragging,
    goToPrev,
    goToNext,
    goToFirst,
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
    isLoadingMore,
    loadMoreError,
    onNeedMore,
    canSwipe: zoom === 1,
  });
  const [loadedImage, setLoadedImage] = useState({
    path: "",
    version: "",
    preview: "",
    full: "",
    high: "",
  });
  const [failedPath, setFailedPath] = useState("");
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
  const [isUiVisible, setIsUiVisible] = useState(true);
  const pointerStart = useRef({ x: 0, y: 0, time: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStart = useRef({ distance: 0, zoom: 1 });
  const pinched = useRef(false);

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!currentPath) return;
    const controller = new AbortController();
    const path = currentPath;
    void getImageThumbnail(path, 320, 3, controller.signal, currentVersion)
      .then((preview) => {
        if (!controller.signal.aborted)
          setLoadedImage((image) =>
            image.path === path && image.version === currentVersion
              ? { ...image, preview }
              : { path, version: currentVersion, preview, full: "", high: "" },
          );
      })
      .catch(() => undefined);
    void getImageThumbnail(path, 1600, 3, controller.signal, currentVersion)
      .then((full) => {
        if (!controller.signal.aborted)
          setLoadedImage((image) =>
            image.path === path && image.version === currentVersion
              ? { ...image, full }
              : { path, version: currentVersion, preview: "", full, high: "" },
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFailedPath(path);
          console.warn("Image preview failed", error);
        }
      });
    if (nextPath) {
      void getImageThumbnail(nextPath, 1600, 2, controller.signal, nextVersion).catch(
        () => undefined,
      );
    }
    return () => controller.abort();
  }, [currentPath, currentVersion, nextPath, nextVersion]);

  useEffect(() => {
    if (
      !currentPath ||
      zoom < 1.5 ||
      loadedImage.high ||
      loadedImage.path !== currentPath ||
      loadedImage.version !== currentVersion
    )
      return;
    const controller = new AbortController();
    const path = currentPath;
    void getImageThumbnail(path, 3200, 3, controller.signal, currentVersion)
      .then((high) => {
        if (!controller.signal.aborted)
          setLoadedImage((image) =>
            image.path === path && image.version === currentVersion ? { ...image, high } : image,
          );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [currentPath, currentVersion, loadedImage.high, loadedImage.path, loadedImage.version, zoom]);

  useEffect(() => {
    if (!playing || !pageVisible || zoom > 1 || !currentImage || isLoadingMore || isWaitingForImage)
      return;
    if (
      loadedImage.path !== currentImage.path ||
      loadedImage.version !== currentVersion ||
      !loadedImage.full
    )
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
    isLoadingMore,
    isWaitingForImage,
    loadedImage.path,
    loadedImage.version,
    loadedImage.full,
    currentIndex,
    totalCount,
    goToFirst,
    goToNext,
    intervalSeconds,
  ]);

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

  const handleViewerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handleViewerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handleViewerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
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
    if (ratio < 0.3) goToPrev();
    else if (ratio > 0.7) goToNext();
    else setIsUiVisible((visible) => !visible);
  };

  const source =
    loadedImage.path === currentImage.path && loadedImage.version === currentVersion
      ? (zoom > 1.5 && loadedImage.high) || loadedImage.full || loadedImage.preview
      : "";

  return (
    <div
      className="image-viewer"
      onPointerDown={handleViewerPointerDown}
      onPointerMove={handleViewerPointerMove}
      onPointerUp={handleViewerPointerUp}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        handlePointerCancel();
        if (pointers.current.size === 0) pinched.current = false;
      }}
      onWheel={(event) => {
        if ((event.target as Element).closest("[data-viewer-control]")) return;
        event.preventDefault();
        changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
      }}
      onDoubleClick={(event) => {
        if (!(event.target as Element).closest("[data-viewer-control]"))
          changeZoom(zoom === 1 ? 2 : 1);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${currentImage.name} 이미지 뷰어`}
    >
      <header
        className={`image-viewer__header ${isUiVisible ? "" : "image-viewer__chrome--hidden"}`}
        data-viewer-control
      >
        <button type="button" className="image-viewer__back" onClick={onClose}>
          <MotionIcon motion="nudge-left">
            <ArrowLeftIcon size={20} />
          </MotionIcon>
          <span>갤러리</span>
        </button>
        <div className="image-viewer__title">
          <strong title={currentImage.name}>{currentImage.name}</strong>
          <span>
            {currentIndex + 1} / {totalCount}
          </span>
        </div>
        <button
          type="button"
          className="image-viewer__close"
          onClick={onClose}
          aria-label="이미지 뷰어 닫기"
        >
          <MotionIcon motion="pop">
            <CloseIcon size={20} />
          </MotionIcon>
        </button>
      </header>

      <div className="image-viewer__canvas">
        {source ? (
          <img
            ref={imageRef}
            src={source}
            alt={currentImage.name}
            className={`image-viewer__image ${fill ? "image-viewer__image--fill" : ""}`}
            draggable={false}
            style={{
              transform: `translate3d(${pan.x + (zoom === 1 ? dragOffset : 0)}px, ${pan.y}px, 0) scale(${zoom})`,
              transition:
                isDragging || zoom > 1 ? "none" : "transform var(--motion-base) var(--ease-out)",
            }}
          />
        ) : failedPath === currentImage.path ? (
          <div className="subpage-state" role="alert">
            <strong>이미지를 표시할 수 없습니다</strong>
            <span>파일 형식을 지원하지 않거나 파일을 읽을 수 없습니다.</span>
          </div>
        ) : (
          <div className="subpage-state" role="status">
            <span className="subpage-state__spinner" />
            <span>이미지를 불러오는 중…</span>
          </div>
        )}
      </div>

      {isWaitingForImage && !loadMoreError && (
        <div className="image-viewer__load-error" data-viewer-control role="status">
          다음 사진을 불러오는 중…
        </div>
      )}

      {currentIndex >= images.length && loadMoreError && (
        <div className="image-viewer__load-error" data-viewer-control role="alert">
          <span>다음 사진을 불러오지 못했습니다.</span>
          <button type="button" onClick={onNeedMore}>
            다시 시도
          </button>
        </div>
      )}

      <div
        className={`image-viewer__controls ${isUiVisible ? "" : "image-viewer__chrome--hidden"}`}
        data-viewer-control
      >
        <button type="button" onClick={goToPrev} disabled={!hasPrev} aria-label="이전 사진">
          ‹
        </button>
        <button
          type="button"
          onClick={() => changeZoom(zoom - 0.5)}
          disabled={zoom <= 1}
          aria-label="축소"
        >
          −
        </button>
        <button type="button" onClick={() => changeZoom(1)} aria-label="원래 크기로">
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => changeZoom(zoom + 0.5)}
          disabled={zoom >= 4}
          aria-label="확대"
        >
          +
        </button>
        <button type="button" onClick={goToNext} disabled={!hasNext} aria-label="다음 사진">
          ›
        </button>
        <span className="image-viewer__control-divider" />
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "자동 재생 일시정지" : "자동 재생 시작"}
        >
          {playing ? "일시정지" : "자동 재생"}
        </button>
        <select
          aria-label="사진 전환 간격"
          value={intervalSeconds}
          onChange={(event) => setIntervalSeconds(Number(event.target.value))}
        >
          <option value={10}>10초</option>
          <option value={15}>15초</option>
          <option value={30}>30초</option>
        </select>
        <button
          type="button"
          onClick={() => setFill((value) => !value)}
          aria-label="사진 맞춤 방식 변경"
        >
          {fill ? "맞춤" : "채우기"}
        </button>
      </div>
    </div>
  );
};
