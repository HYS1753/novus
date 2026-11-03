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
      aria-label="동영상 플레이어 컨트롤"
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
            aria-label="재생 위치 탐색 바"
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
            title={isPaused ? "재생 (스페이스)" : "일시정지 (스페이스)"}
            aria-label={isPaused ? "재생" : "일시정지"}
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
            title="10초 뒤로 (←)"
            aria-label="10초 뒤로"
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
            title="10초 앞으로 (→)"
            aria-label="10초 앞으로"
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
              title={isMuted ? "음소거 해제 (M)" : "음소거 (M)"}
              aria-label={isMuted ? "음소거 해제" : "음소거"}
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
                aria-label="음량 조절"
              />
            </div>
          </div>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              className="video-player-controls__btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? "전체화면 종료 (F)" : "전체화면 (F)"}
              aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
            >
              <MotionIcon motion="pop">
                <FullscreenIcon size={20} />
              </MotionIcon>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

VideoPlayerControls.displayName = "VideoPlayerControls";
