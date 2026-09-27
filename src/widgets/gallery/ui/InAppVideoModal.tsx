import React, { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "@/entities";
import { useNativeVideoPlayer } from "@/features";
import {
  ArrowLeftIcon,
  GlassButton,
  MotionIcon,
  PlayIcon,
  closeEmbeddedVideo,
  controlEmbeddedVideo,
  convertFileSrc,
  getEmbeddedPlayerSupport,
  isTauriRuntime,
  openEmbeddedVideo,
  updateEmbeddedVideoBounds,
  type EmbeddedPlayerAction,
} from "@/shared";

interface InAppVideoModalProps {
  video: FileItem;
  onClose: () => void;
}

export const InAppVideoModal: React.FC<InAppVideoModalProps> = ({ video, onClose }) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const { isPlaying, playVideo, feedback } = useNativeVideoPlayer();
  const [videoError, setVideoError] = useState(false);
  const [nativeSessionId, setNativeSessionId] = useState<string | null>(null);
  const [nativeControlError, setNativeControlError] = useState(false);
  const [engine, setEngine] = useState<"checking" | "native" | "web">(() =>
    isTauriRuntime() ? "checking" : "web",
  );
  const handleNativeError = useCallback(() => setVideoError(true), []);
  const clearNativeSession = useCallback(() => setNativeSessionId(null), []);

  const handleNativeControl = (action: EmbeddedPlayerAction) => {
    if (!nativeSessionId) return;
    void controlEmbeddedVideo(nativeSessionId, action)
      .then(() => setNativeControlError(false))
      .catch(() => setNativeControlError(true));
  };

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    void getEmbeddedPlayerSupport()
      .then((support) => {
        if (!cancelled) setEngine(support.available ? "native" : "web");
      })
      .catch(() => {
        if (!cancelled) setEngine("web");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleExternalFallback = () => void playVideo(video.path);

  return (
    <div className="video-modal" role="dialog" aria-modal="true" aria-label={`${video.name} 재생`}>
      <header className="video-modal__header">
        <button type="button" className="image-viewer__back" onClick={onClose}>
          <MotionIcon motion="nudge-left">
            <ArrowLeftIcon size={20} />
          </MotionIcon>
          <span>갤러리</span>
        </button>
        <div className="video-modal__title">
          <strong title={video.name}>{video.name}</strong>
          <span>
            {video.extension.toUpperCase()} ∙ {(video.size / 1024 ** 2).toFixed(1)} MB
          </span>
        </div>
        <span className="video-modal__engine">
          {engine === "checking"
            ? "NOVUS · 확인 중"
            : engine === "native"
              ? "NOVUS · MPV"
              : "NOVUS · WEBVIEW"}
        </span>
      </header>

      <main
        className={`video-modal__canvas${engine === "native" ? " video-modal__canvas--native" : ""}`}
      >
        {videoError ? (
          <div className="video-modal__error">
            <span className="video-modal__error-icon">
              <MotionIcon motion="pulse" active>
                <PlayIcon size={34} />
              </MotionIcon>
            </span>
            <h2>동영상을 재생할 수 없습니다</h2>
            <p>
              재생 엔진이 파일을 열지 못했습니다. 파일 형식이나 설치된 재생 엔진을 확인해 주세요.
            </p>
            <GlassButton variant="primary" onClick={handleExternalFallback} isLoading={isPlaying}>
              시스템 플레이어로 열기
            </GlassButton>
          </div>
        ) : engine === "native" ? (
          <NativeVideoSurface
            video={video}
            onError={handleNativeError}
            onReady={setNativeSessionId}
            onClosed={clearNativeSession}
          />
        ) : engine === "checking" ? (
          <div className="video-modal__loading">재생 엔진 확인 중…</div>
        ) : (
          <video
            ref={playerRef}
            src={convertFileSrc(video.path)}
            className="video-modal__player"
            controls
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
          />
        )}
      </main>

      {engine === "native" && nativeSessionId && !videoError && (
        <div className="video-modal__native-controls" aria-label="영상 재생 조작">
          <button type="button" onClick={() => handleNativeControl("seek_backward")}>
            -10초
          </button>
          <button type="button" onClick={() => handleNativeControl("toggle_pause")}>
            재생 / 일시정지
          </button>
          <button type="button" onClick={() => handleNativeControl("seek_forward")}>
            +10초
          </button>
        </div>
      )}

      {nativeControlError && (
        <div className="video-modal__feedback video-modal__feedback--native">
          재생 조작을 완료하지 못했습니다.
        </div>
      )}

      {feedback && <div className="video-modal__feedback">{feedback.message}</div>}
    </div>
  );
};

const NativeVideoSurface: React.FC<{
  video: FileItem;
  onError: () => void;
  onReady: (sessionId: string) => void;
  onClosed: () => void;
}> = ({ video, onError, onReady, onClosed }) => {
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const sessionId = crypto.randomUUID();
    let cancelled = false;
    let opened = false;
    let frame = 0;

    const measure = () => {
      const rect = surface.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const scheduleResize = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (opened && !cancelled) void updateEmbeddedVideoBounds(sessionId, measure());
      });
    };

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(surface);
    window.addEventListener("resize", scheduleResize);
    void openEmbeddedVideo(sessionId, video.path, measure())
      .then(() => {
        opened = true;
        if (cancelled) void closeEmbeddedVideo(sessionId);
        else {
          onReady(sessionId);
          scheduleResize();
        }
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
      if (frame) cancelAnimationFrame(frame);
      if (opened) void closeEmbeddedVideo(sessionId);
      onClosed();
    };
  }, [video.path, onError, onReady, onClosed]);

  return (
    <div ref={surfaceRef} className="video-modal__native-surface" aria-label="동영상 재생 영역" />
  );
};
