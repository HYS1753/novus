import React, { useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  Replay10Icon,
  Forward10Icon,
  VolumeIcon,
  VolumeMuteIcon,
  FullscreenIcon,
} from "@/shared/ui/icons/SystemIcons";
import { NvIconMotion } from "@/shared/ui/v2/NvIconMotion";
import { useI18n } from "@/shared/hooks/useI18n";
import "./video-controls.css";

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
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

/**
 * The player's controls (v2): a white timeline, play as the one filled
 * circle, ±10s, the time, volume, and fullscreen. Rendered over the bottom
 * scrim of the video stage (see `video-player.css`).
 */
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
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  const displayTime = scrubValue ?? currentTime;
  // 0..1, for transforms (no percentage arithmetic in CSS).
  const progress = duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;
  const effectiveVolume = isMuted ? 0 : volume;

  const commitSeek = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const value = Number(event.currentTarget.value);
    setScrubValue(null);
    onSeek(value);
  };

  return (
    <div
      className={`vpc ${className}`}
      role="region"
      aria-label={t("video.controls")}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="vpc__timeline" style={{ ["--vpc-progress" as string]: progress }}>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 100}
          step={0.1}
          value={displayTime}
          onChange={(event) => setScrubValue(Number(event.target.value))}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          className="vpc__range"
          aria-label={t("video.seek")}
          aria-valuetext={`${formatTime(displayTime)} / ${formatTime(duration)}`}
        />
        <span className="vpc__track" aria-hidden="true">
          <span className="vpc__fill" />
        </span>
        <span className="vpc__thumb" aria-hidden="true" />
      </div>

      <div className="vpc__bar">
        <div className="vpc__group">
          <button
            type="button"
            className="vpc__btn vpc__btn--play"
            onClick={onTogglePlay}
            title={isPaused ? t("video.playHint") : t("video.pauseHint")}
            aria-label={isPaused ? t("video.play") : t("video.pause")}
          >
            <NvIconMotion>
              {isPaused ? <PlayIcon size={24} /> : <PauseIcon size={24} />}
            </NvIconMotion>
          </button>
          <button
            type="button"
            className="vpc__btn"
            onClick={() => onSeekRelative(-10)}
            title={t("video.back10Hint")}
            aria-label={t("video.back10")}
          >
            <NvIconMotion>
              <Replay10Icon size={22} />
            </NvIconMotion>
          </button>
          <button
            type="button"
            className="vpc__btn"
            onClick={() => onSeekRelative(10)}
            title={t("video.fwd10Hint")}
            aria-label={t("video.fwd10")}
          >
            <NvIconMotion>
              <Forward10Icon size={22} />
            </NvIconMotion>
          </button>
          <span className="vpc__time" aria-live="off">
            {formatTime(displayTime)}
            <span className="vpc__time-sep">/</span>
            {formatTime(duration)}
          </span>
        </div>

        <div className="vpc__group">
          <button
            type="button"
            className="vpc__btn"
            onClick={onToggleMute}
            title={isMuted ? t("video.unmuteHint") : t("video.muteHint")}
            aria-label={isMuted ? t("video.unmute") : t("video.mute")}
          >
            <NvIconMotion>
              {effectiveVolume === 0 ? <VolumeMuteIcon size={22} /> : <VolumeIcon size={22} />}
            </NvIconMotion>
          </button>
          <span
            className="vpc__volume"
            style={{ ["--vpc-volume" as string]: effectiveVolume / 100 }}
          >
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={effectiveVolume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              className="vpc__range"
              aria-label={t("video.volume")}
            />
            <span className="vpc__track" aria-hidden="true">
              <span className="vpc__fill" />
            </span>
          </span>
          {onToggleFullscreen && (
            <button
              type="button"
              className="vpc__btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? t("video.exitFullscreenHint") : t("video.fullscreenHint")}
              aria-label={isFullscreen ? t("video.exitFullscreen") : t("video.fullscreen")}
            >
              <NvIconMotion>
                <FullscreenIcon size={20} isFullscreen={isFullscreen} />
              </NvIconMotion>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

VideoPlayerControls.displayName = "VideoPlayerControls";
