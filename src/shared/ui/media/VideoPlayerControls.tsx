import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  PlayIcon,
  PauseIcon,
  Replay10Icon,
  Forward10Icon,
  VolumeIcon,
  VolumeMuteIcon,
  FullscreenIcon,
} from "@/shared/ui/icons/SystemIcons";
import { MotionIcon } from "@/shared/ui/icons/MotionIcon";
import { useI18n } from "@/shared/hooks/useI18n";

export interface VideoPlayerControlsProps {
  currentTime: number;
  duration: number;
  isPaused: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSeekRelative: (deltaSeconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
  currentTime,
  duration,
  isPaused,
  volume,
  isMuted,
  isFullscreen = false,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  className = "",
}) => {
  const { t } = useI18n();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const volumeLeaveTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (volumeLeaveTimeoutRef.current !== null)
        window.clearTimeout(volumeLeaveTimeoutRef.current);
    },
    [],
  );

  const displayTime = isScrubbing && scrubValue !== null ? scrubValue : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const effectiveVolume = isMuted ? 0 : volume;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setScrubValue(val);
    if (!isScrubbing) {
      setIsScrubbing(true);
    }
  };

  const handleSeekCommit = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const val = Number((e.target as HTMLInputElement).value);
    setIsScrubbing(false);
    setScrubValue(null);
    onSeek(val);
  };

  const handleVolumeMouseEnter = useCallback(() => {
    if (volumeLeaveTimeoutRef.current) {
      window.clearTimeout(volumeLeaveTimeoutRef.current);
      volumeLeaveTimeoutRef.current = null;
    }
    setIsVolumeHovered(true);
  }, []);

  const handleVolumeMouseLeave = useCallback(() => {
    volumeLeaveTimeoutRef.current = window.setTimeout(() => {
      setIsVolumeHovered(false);
    }, 400);
  }, []);

  return (
    <div
      className={`video-player-controls ${className}`}
      role="region"
      aria-label={t("video.controls")}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Timeline Seek Bar */}
      <div className="video-player-controls__timeline-wrap">
        <div className="video-player-controls__timeline">
          <div
            className="video-player-controls__timeline-fill"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="video-player-controls__timeline-thumb"
            style={{ left: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.1}
            value={displayTime}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
            onKeyUp={handleSeekCommit}
            className="video-player-controls__timeline-input"
            aria-label={t("video.seek")}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={displayTime}
            aria-valuetext={`${formatTime(displayTime)} / ${formatTime(duration)}`}
          />
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="video-player-controls__toolbar">
        {/* Left Section: Play/Pause, Skips, and Time */}
        <div className="video-player-controls__group video-player-controls__group--left">
          {/* Play/Pause Button */}
          <button
            type="button"
            className="video-player-controls__btn video-player-controls__btn--play"
            onClick={onTogglePlay}
            title={isPaused ? t("video.playHint") : t("video.pauseHint")}
            aria-label={isPaused ? t("video.play") : t("video.pause")}
          >
            <MotionIcon motion="pop" active={!isPaused}>
              {isPaused ? <PlayIcon size={24} /> : <PauseIcon size={24} />}
            </MotionIcon>
          </button>

          {/* 10s Replay Button */}
          <button
            type="button"
            className="video-player-controls__btn"
            onClick={() => onSeekRelative(-10)}
            title={t("video.back10Hint")}
            aria-label={t("video.back10")}
          >
            <MotionIcon motion="nudge-left">
              <Replay10Icon size={22} />
            </MotionIcon>
          </button>

          {/* 10s Forward Button */}
          <button
            type="button"
            className="video-player-controls__btn"
            onClick={() => onSeekRelative(10)}
            title={t("video.fwd10Hint")}
            aria-label={t("video.fwd10")}
          >
            <MotionIcon motion="nudge-right">
              <Forward10Icon size={22} />
            </MotionIcon>
          </button>

          {/* Time Display */}
          <div className="video-player-controls__time" aria-live="off">
            <span className="video-player-controls__time-current">{formatTime(displayTime)}</span>
            <span className="video-player-controls__time-sep">/</span>
            <span className="video-player-controls__time-duration">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Section: Volume and Fullscreen */}
        <div className="video-player-controls__group video-player-controls__group--right">
          {/* Volume Group */}
          <div
            className={`video-player-controls__volume-group ${isVolumeHovered ? "is-expanded" : ""}`}
            onMouseEnter={handleVolumeMouseEnter}
            onMouseLeave={handleVolumeMouseLeave}
            onTouchStart={() => setIsVolumeHovered((prev) => !prev)}
          >
            <button
              type="button"
              className="video-player-controls__btn"
              onClick={onToggleMute}
              title={isMuted ? t("video.unmuteHint") : t("video.muteHint")}
              aria-label={isMuted ? t("video.unmute") : t("video.mute")}
            >
              <MotionIcon motion="pop">
                {isMuted || effectiveVolume === 0 ? (
                  <VolumeMuteIcon size={22} />
                ) : (
                  <VolumeIcon size={22} />
                )}
              </MotionIcon>
            </button>

            <div className="video-player-controls__volume-slider-wrap">
              <div className="video-player-controls__volume-track">
                <div
                  className="video-player-controls__volume-fill"
                  style={{ width: `${effectiveVolume}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={effectiveVolume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="video-player-controls__volume-input"
                aria-label={t("video.volume")}
              />
            </div>
          </div>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              className="video-player-controls__btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? t("video.exitFullscreenHint") : t("video.fullscreenHint")}
              aria-label={isFullscreen ? t("video.exitFullscreen") : t("video.fullscreen")}
            >
              <MotionIcon motion="pop">
                <FullscreenIcon size={20} isFullscreen={isFullscreen} />
              </MotionIcon>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

VideoPlayerControls.displayName = "VideoPlayerControls";
