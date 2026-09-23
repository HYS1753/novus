import { useState, useEffect, useCallback, useRef } from "react";
import type { FileItem } from "@/entities";

interface UseImageViewerOptions {
  images: FileItem[];
  initialIndex: number;
  onClose: () => void;
}

export function useImageViewer({ images, initialIndex, onClose }: UseImageViewerOptions) {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startXRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);

  const [prevInitialIndex, setPrevInitialIndex] = useState<number>(initialIndex);
  if (prevInitialIndex !== initialIndex) {
    setPrevInitialIndex(initialIndex);
    setCurrentIndex(initialIndex);
  }

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentIndex((prev) => prev - 1);
      setDragOffset(0);
    }
  }, [hasPrev]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex((prev) => prev + 1);
      setDragOffset(0);
    }
  }, [hasNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, onClose]);

  // Pointer / Touch gestures
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const currentX = e.clientX;
    const diff = currentX - startXRef.current;

    // Dampen drag if at boundary
    if ((!hasPrev && diff > 0) || (!hasNext && diff < 0)) {
      setDragOffset(diff * 0.3);
    } else {
      setDragOffset(diff);
    }
  };

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    const threshold = 60; // minimum pixels to trigger swipe
    if (dragOffset > threshold && hasPrev) {
      goToPrev();
    } else if (dragOffset < -threshold && hasNext) {
      goToNext();
    } else {
      setDragOffset(0);
    }
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
  };

  // 3-slide ring buffer items
  const currentImage = images[currentIndex] || null;
  const prevImage = hasPrev ? images[currentIndex - 1] : null;
  const nextImage = hasNext ? images[currentIndex + 1] : null;

  return {
    currentIndex,
    totalCount: images.length,
    currentImage,
    prevImage,
    nextImage,
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
    onClose,
  };
}
