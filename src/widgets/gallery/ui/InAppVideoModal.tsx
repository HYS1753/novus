import React, { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "@/entities";
import { useNativeVideoPlayer } from "@/features";
import {
  ArrowLeftIcon,
  GlassButton,
  MotionIcon,
  PlayIcon,
  VideoPlayerControls,
  closeEmbeddedVideo,
  controlEmbeddedVideo,
  convertFileSrc,
  getEmbeddedPlayerSupport,
  getEmbeddedVideoState,
  isTauriRuntime,
  openEmbeddedVideo,
  updateEmbeddedVideoBounds,
} from "@/shared";

interface InAppVideoModalProps {
  video: FileItem;
  onClose: () => void;
}

export const InAppVideoModal: React.FC<InAppVideoModalProps> = ({ video, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const { isPlaying, playVideo, feedback } = useNativeVideoPlayer();

  const [videoError, setVideoError] = useState(false);
  const [nativeSessionId, setNativeSessionId] = useState<string | null>(null);
  const [nativeControlError, setNativeControlError] = useState(false);
  const [engine, setEngine] = useState<"checking" | "native" | "web">(() =>
    isTauriRuntime() ? "checking" : "web",
  );

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-hide controls on inactivity
  const [userActive, setUserActive] = useState(true);
  const [activityKey, setActivityKey] = useState(0);

  const notifyActivity = useCallback(() => {
    setUserActive(true);
    setActivityKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setTimeout(() => {
      setUserActive(false);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [isPaused, activityKey]);

  const isControlsVisible = isPaused || userActive;

  const handleNativeError = useCallback(() => setVideoError(true), []);
  const clearNativeSession = useCallback(() => {
    setNativeSessionId(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Check hardware acceleration engine support
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

  // Poll native MPV state
  useEffect(() => {
    if (engine !== "native" || !nativeSessionId) return;
    let active = true;

    const refreshState = () => {
      if (!active) return;
      void getEmbeddedVideoState(nativeSessionId)
        .then((state) => {
          if (!active) return;
          setCurrentTime(state.position);
          if (state.duration > 0) setDuration(state.duration);
          setIsPaused(state.paused);
          setVolume(state.volume);
          setIsMuted(state.muted);
        })
        .catch(() => {});
    };
    refreshState();
    const interval = window.setInterval(refreshState, 10_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [engine, nativeSessionId]);

  // Handle Play/Pause
  const handleTogglePlay = useCallback(() => {
    if (engine === "native" && nativeSessionId) {
      const nextPaused = !isPaused;
      setIsPaused(nextPaused);
      void controlEmbeddedVideo(nativeSessionId, nextPaused ? "pause" : "play")
        .then(() => setNativeControlError(false))
        .catch(() => setNativeControlError(true));
    } else if (playerRef.current) {
      if (playerRef.current.paused) {
        void playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }
    notifyActivity();
  }, [engine, nativeSessionId, isPaused, notifyActivity]);

  // Handle Seek
  const handleSeek = useCallback(
    (seconds: number) => {
      setCurrentTime(seconds);
      if (engine === "native" && nativeSessionId) {
        void controlEmbeddedVideo(nativeSessionId, { seek_to: seconds })
          .then(() => setNativeControlError(false))
          .catch(() => setNativeControlError(true));
      } else if (playerRef.current) {
        playerRef.current.currentTime = seconds;
      }
      notifyActivity();
    },
    [engine, nativeSessionId, notifyActivity],
  );

  // Handle Relative Seek (+/-10s)
  const handleSeekRelative = useCallback(
    (delta: number) => {
      setCurrentTime((prev) => Math.max(0, Math.min(duration || 100, prev + delta)));
      if (engine === "native" && nativeSessionId) {
        void controlEmbeddedVideo(nativeSessionId, delta < 0 ? "seek_backward" : "seek_forward")
          .then(() => setNativeControlError(false))
          .catch(() => setNativeControlError(true));
      } else if (playerRef.current) {
        playerRef.current.currentTime = Math.max(
          0,
          Math.min(playerRef.current.duration || 100, playerRef.current.currentTime + delta),
        );
      }
      notifyActivity();
    },
    [engine, nativeSessionId, duration, notifyActivity],
  );

  // Handle Volume Change
  const handleVolumeChange = useCallback(
    (vol: number) => {
      setVolume(vol);
      if (isMuted && vol > 0) setIsMuted(false);

      if (engine === "native" && nativeSessionId) {
        void controlEmbeddedVideo(nativeSessionId, { set_volume: vol })
          .then(() => {
            if (isMuted && vol > 0) return controlEmbeddedVideo(nativeSessionId, "toggle_mute");
          })
          .then(() => setNativeControlError(false))
          .catch(() => setNativeControlError(true));
      } else if (playerRef.current) {
        playerRef.current.volume = vol / 100;
        if (isMuted && vol > 0) {
          playerRef.current.muted = false;
        }
      }
      notifyActivity();
    },
    [engine, nativeSessionId, isMuted, notifyActivity],
  );

  // Handle Mute Toggle
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (engine === "native" && nativeSessionId) {
      void controlEmbeddedVideo(nativeSessionId, "toggle_mute")
        .then(() => setNativeControlError(false))
        .catch(() => setNativeControlError(true));
    } else if (playerRef.current) {
      playerRef.current.muted = !playerRef.current.muted;
      setIsMuted(playerRef.current.muted);
    }
    notifyActivity();
  }, [engine, nativeSessionId, notifyActivity]);

  // Handle Fullscreen Toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void modalRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
    notifyActivity();
  }, [notifyActivity]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest("input, button, select, textarea") || event.target.isContentEditable)
      )
        return;
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === " " || event.key === "k") {
        event.preventDefault();
        handleTogglePlay();
      } else if (event.key === "ArrowLeft" || event.key === "j") {
        event.preventDefault();
        handleSeekRelative(-10);
      } else if (event.key === "ArrowRight" || event.key === "l") {
        event.preventDefault();
        handleSeekRelative(10);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        handleVolumeChange(Math.min(100, volume + 5));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        handleVolumeChange(Math.max(0, volume - 5));
      } else if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        handleToggleMute();
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        handleToggleFullscreen();
      }
      notifyActivity();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onClose,
    handleTogglePlay,
    handleSeekRelative,
    handleVolumeChange,
    volume,
    handleToggleMute,
    handleToggleFullscreen,
    notifyActivity,
  ]);

  const handleExternalFallback = () => void playVideo(video.path);

  return (
    <div
      ref={modalRef}
      className="video-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${video.name} 재생`}
      onMouseMove={notifyActivity}
      onTouchStart={notifyActivity}
    >
      {/* Header */}
      <header
        className={`video-modal__header ${!isControlsVisible ? "video-modal__chrome--hidden" : ""}`}
      >
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

      {/* Main Video Canvas */}
      <main
        className={`video-modal__canvas${engine === "native" ? " video-modal__canvas--native" : ""}`}
        onClick={handleTogglePlay}
      >
        {videoError ? (
          <div className="video-modal__error" onClick={(e) => e.stopPropagation()}>
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
            autoPlay
            playsInline
            preload="metadata"
            onTimeUpdate={() => {
              if (playerRef.current) {
                setCurrentTime(playerRef.current.currentTime);
              }
            }}
            onDurationChange={() => {
              if (playerRef.current) {
                setDuration(playerRef.current.duration);
              }
            }}
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
            onVolumeChange={() => {
              if (playerRef.current) {
                setVolume(playerRef.current.volume * 100);
                setIsMuted(playerRef.current.muted);
              }
            }}
            onError={() => setVideoError(true)}
          />
        )}
      </main>

      {/* Modern Floating Video Player Controls */}
      {!videoError && engine !== "checking" && (
        <div
          className={`video-modal__controls ${!isControlsVisible ? "video-modal__chrome--hidden" : ""}`}
        >
          <VideoPlayerControls
            currentTime={currentTime}
            duration={duration}
            isPaused={isPaused}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onSeekRelative={handleSeekRelative}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={handleToggleFullscreen}
          />
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
