import React, { useEffect, useRef, useState } from "react";
import type { FileItem } from "@/entities";
import { useImageViewer } from "@/features";
import { ArrowLeftIcon, CloseIcon, MotionIcon, getImageThumbnail } from "@/shared";

interface FullscreenImageViewerProps {
  images: FileItem[];
  initialIndex: number;
  onClose: () => void;
}

export const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({
  images,
  initialIndex,
  onClose,
}) => {
  const {
    currentIndex,
    totalCount,
    currentImage,
    hasPrev,
    hasNext,
    dragOffset,
    isDragging,
    goToPrev,
    goToNext,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useImageViewer({ images, initialIndex, onClose });
  const [loadedImage, setLoadedImage] = useState({ path: "", source: "" });
  const [isUiVisible, setIsUiVisible] = useState(true);
  const pointerStart = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    let active = true;
    if (!currentImage) return;
    void getImageThumbnail(currentImage.path, 1600)
      .then((value) => {
        if (active) setLoadedImage({ path: currentImage.path, source: value });
      })
      .catch(() => {
        if (active) setLoadedImage({ path: currentImage.path, source: "" });
      });
    return () => {
      active = false;
    };
  }, [currentImage]);

  if (!currentImage) return null;

  const handleViewerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-viewer-control]")) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    handlePointerDown(event);
  };

  const handleViewerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-viewer-control]")) return;
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

  return (
    <div
      className="image-viewer"
      onPointerDown={handleViewerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleViewerPointerUp}
      onPointerCancel={handlePointerCancel}
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
        {loadedImage.path !== currentImage.path ? (
          <div className="subpage-state" role="status">
            <span className="subpage-state__spinner" />
            <span>이미지를 불러오는 중…</span>
          </div>
        ) : (
          <img
            src={loadedImage.source}
            alt={currentImage.name}
            className="image-viewer__image"
            draggable={false}
            style={{
              transform: `translate3d(${dragOffset}px, 0, 0)`,
              transition: isDragging ? "none" : "transform var(--motion-base) var(--ease-out)",
            }}
          />
        )}
      </div>

      <div
        className={`image-viewer__hints ${isUiVisible ? "" : "image-viewer__chrome--hidden"}`}
        aria-hidden="true"
      >
        <span className={hasPrev ? "" : "image-viewer__hint--disabled"}>
          <ArrowLeftIcon size={22} />
        </span>
        <small>좌우 30% 이동 ∙ 중앙 40% 컨트롤 숨김</small>
        <span
          className={
            hasNext ? "image-viewer__next" : "image-viewer__next image-viewer__hint--disabled"
          }
        >
          <ArrowLeftIcon size={22} />
        </span>
      </div>
    </div>
  );
};
