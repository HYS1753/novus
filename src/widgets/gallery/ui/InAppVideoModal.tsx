import React, { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "@/entities";
import { useNativeVideoPlayer } from "@/features";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  NvButton,
  NvIconMotion,
  PlayIcon,
  closeWindow,
  VideoPlayerControls,
  closeEmbeddedVideo,
  controlEmbeddedVideo,
  convertFileSrc,
  getEmbeddedPlayerSupport,
  getEmbeddedVideoState,
  listenEmbeddedVideoInput,
  openEmbeddedVideoOverlay,
  requestEmbeddedVideoOverlayAction,
  toggleFullscreen,
  isTauriRuntime,
  openEmbeddedVideo,
  updateEmbeddedVideoBounds,
  useDisplayMode,
  getDisplayMode,
  exitWindowFullscreen,
  reportWindowModeError,
  useI18n,
} from "@/shared";
import "./video-player.css";

interface InAppVideoModalProps {
  video: FileItem;
  onClose: () => void;
  overlaySessionId?: string;
  onExit?: () => void;
}

export const InAppVideoModal: React.FC<InAppVideoModalProps> = ({
  video,
  onClose,
  overlaySessionId,
  onExit,
}) => {
  const { t } = useI18n();
  const modalRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const escapePendingRef = useRef(false);
  const { isPlaying, playVideo, feedback } = useNativeVideoPlayer();

  const [videoError, setVideoError] = useState(false);
  const [nativeSessionId, setNativeSessionId] = useState<string | null>(overlaySessionId ?? null);
  const [nativeControlError, setNativeControlError] = useState(false);
  const [engine, setEngine] = useState<"checking" | "native" | "web">(() =>
    overlaySessionId ? "native" : isTauriRuntime() ? "checking" : "web",
  );
  const [usesNativeOverlay, setUsesNativeOverlay] = useState(false);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const displayMode = useDisplayMode();
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const isFullscreen = isTauriRuntime() ? displayMode.appFullscreen : browserFullscreen;

  // Auto-hide controls on inactivity
  const [userActive, setUserActive] = useState(true);
  const [activityKey, setActivityKey] = useState(0);
  const [nativeInputReady, setNativeInputReady] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const notifyActivity = useCallback(() => {
    setUserActive(true);
    setActivityKey((prev) => prev + 1);
  }, []);

  const toggleControls = useCallback(() => {
    setUserActive((visible) => !visible);
    setActivityKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!nativeSessionId) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenEmbeddedVideoInput(nativeSessionId, (action) => {
      if (cancelled) return;
      if (action === "close") onClose();
      else if (action === "exit") void closeWindow();
      else if (action === "fullscreen" && !overlaySessionId) void toggleFullscreen();
      else toggleControls();
    })
      .then((dispose) => {
        if (cancelled) dispose();
        else {
          unlisten = dispose;
          setNativeInputReady(true);
        }
      })
      .catch(() => setNativeControlError(true));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [nativeSessionId, onClose, overlaySessionId, toggleControls]);

  useEffect(() => {
    const finish = () => setIsInteracting(false);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", finish);
    };
  }, []);

  useEffect(() => {
    if (engine === "checking" || videoError || isInteracting || !userActive) return;
    const timer = window.setTimeout(() => {
      setUserActive(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [activityKey, engine, videoError, isInteracting, userActive]);

  const isControlsVisible = videoError || userActive || (engine === "native" && !nativeInputReady);

  const handleNativeError = useCallback(() => setVideoError(true), []);
  const clearNativeSession = useCallback(() => {
    setNativeInputReady(false);
    setNativeSessionId(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Check hardware acceleration engine support
  useEffect(() => {
    if (!isTauriRuntime() || overlaySessionId) return;
    let cancelled = false;
    void getEmbeddedPlayerSupport()
      .then((support) => {
        if (!cancelled) {
          setUsesNativeOverlay(support.available && support.platform === "windows");
          setEngine(support.available ? "native" : "web");
        }
      })
      .catch(() => {
        if (!cancelled) setEngine("web");
      });
    return () => {
      cancelled = true;
    };
  }, [overlaySessionId]);

  // Poll native MPV state
  useEffect(() => {
    if (engine !== "native" || !nativeSessionId || usesNativeOverlay) return;
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
  }, [engine, nativeSessionId, usesNativeOverlay]);

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
    if (overlaySessionId) {
      void requestEmbeddedVideoOverlayAction(overlaySessionId, "fullscreen");
      notifyActivity();
      return;
    }
    if (isTauriRuntime()) {
      void toggleFullscreen();
    } else if (!document.fullscreenElement) {
      void modalRef.current?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
    notifyActivity();
  }, [notifyActivity, overlaySessionId]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat || escapePendingRef.current) return;
        escapePendingRef.current = true;
        void getDisplayMode()
          .then(async (mode) => {
            if (mode.appFullscreen) await exitWindowFullscreen();
            else onClose();
          })
          .catch(reportWindowModeError)
          .finally(() => {
            escapePendingRef.current = false;
          });
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest("input, button, select, textarea") || event.target.isContentEditable)
      )
        return;
      if (event.key === " " || event.key === "k") {
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
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
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
      className={`vp${usesNativeOverlay && !videoError ? " vp--native-host" : ""}${overlaySessionId ? " vp--overlay" : ""}`}
      data-chrome={isControlsVisible || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={t("video.playing", { name: video.name })}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") notifyActivity();
      }}
      onFocusCapture={notifyActivity}
    >
      {/* Top bar over the video's top scrim */}
      <header className="vp__top" inert={!isControlsVisible}>
        <button
          type="button"
          className="vp__circle"
          onClick={onClose}
          aria-label={t("nav.gallery")}
          title={t("nav.gallery")}
        >
          <NvIconMotion>
            <ArrowLeftIcon size={22} />
          </NvIconMotion>
        </button>
        <div className="vp__title">
          <strong title={video.name}>{video.name}</strong>
          <span>
            {video.extension.toUpperCase()} · {(video.size / 1024 ** 2).toFixed(1)} MB
          </span>
        </div>
        <span className="vp__engine">
          {engine === "checking"
            ? t("video.engineCheckingShort")
            : engine === "native"
              ? "NOVUS · MPV"
              : "NOVUS · WEBVIEW"}
        </span>
        <button
          type="button"
          className="vp__quit"
          onClick={() => (onExit ? onExit() : void closeWindow())}
          aria-label={t("video.quit")}
          title={t("video.quit")}
        >
          {t("video.quitShort")}
        </button>
      </header>

      {/* Main Video Canvas */}
      <main
        className={`vp__stage${engine === "native" ? " vp__stage--native" : ""}`}
        onClick={toggleControls}
      >
        {videoError ? (
          <div className="vp__error" onClick={(e) => e.stopPropagation()}>
            <span className="vp__error-icon" aria-hidden="true">
              <PlayIcon size={30} />
            </span>
            <h2>{t("video.cantPlay")}</h2>
            <p>{t("video.cantPlayHint")}</p>
            <NvButton
              variant="primary"
              icon={<ExternalLinkIcon size={18} />}
              onClick={handleExternalFallback}
              disabled={isPlaying}
              aria-busy={isPlaying || undefined}
            >
              {t("video.openSystem")}
            </NvButton>
          </div>
        ) : overlaySessionId ? null : engine === "native" ? (
          <NativeVideoSurface
            video={video}
            onError={handleNativeError}
            onReady={usesNativeOverlay ? undefined : setNativeSessionId}
            overlayReady={usesNativeOverlay ? setNativeSessionId : undefined}
            onClosed={clearNativeSession}
          />
        ) : engine === "checking" ? (
          <span className="vp__status">{t("video.engineChecking")}</span>
        ) : (
          <video
            ref={playerRef}
            src={convertFileSrc(video.path)}
            className="vp__video"
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
      {!videoError && engine !== "checking" && !usesNativeOverlay && (
        <div
          className="vp__bottom"
          inert={!isControlsVisible}
          onPointerDown={() => {
            setIsInteracting(true);
            notifyActivity();
          }}
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
        <div className="vp__notice vp__notice--raised" role="status">
          {t("video.controlFailed")}
        </div>
      )}

      {feedback && (
        <div className="vp__notice" role="status">
          {feedback.message}
        </div>
      )}
    </div>
  );
};

const NativeVideoSurface: React.FC<{
  video: FileItem;
  onError: () => void;
  onReady?: (sessionId: string) => void;
  overlayReady?: (sessionId: string) => void;
  onClosed: () => void;
}> = ({ video, onError, onReady, overlayReady, onClosed }) => {
  const { t } = useI18n();
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
        if (opened && !cancelled)
          void updateEmbeddedVideoBounds(sessionId, measure()).catch(onError);
      });
    };

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(surface);
    window.addEventListener("resize", scheduleResize);
    void openEmbeddedVideo(sessionId, video.path, measure())
      .then(async () => {
        opened = true;
        if (cancelled) void closeEmbeddedVideo(sessionId).catch(console.error);
        else {
          onReady?.(sessionId);
          overlayReady?.(sessionId);
          if (overlayReady) {
            await openEmbeddedVideoOverlay(sessionId, video);
            if (cancelled) {
              await closeEmbeddedVideo(sessionId);
              return;
            }
          }
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
      if (opened) void closeEmbeddedVideo(sessionId).catch(console.error);
      onClosed();
    };
  }, [video, onError, onReady, overlayReady, onClosed]);

  return <div ref={surfaceRef} className="vp__surface" aria-label={t("video.surface")} />;
};
