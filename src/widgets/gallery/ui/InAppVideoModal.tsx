import React, { useEffect, useRef, useState } from "react";
import type { FileItem } from "@/entities";
import { useNativeVideoPlayer } from "@/features";
import { ArrowLeftIcon, GlassButton, MotionIcon, PlayIcon, convertFileSrc } from "@/shared";

interface InAppVideoModalProps {
  video: FileItem;
  onClose: () => void;
}

export const InAppVideoModal: React.FC<InAppVideoModalProps> = ({ video, onClose }) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const { isPlaying, playVideo, feedback } = useNativeVideoPlayer();
  const [videoError, setVideoError] = useState(false);

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
        <span className="video-modal__engine">NOVUS IN-APP</span>
      </header>

      <main className="video-modal__canvas">
        {videoError ? (
          <div className="video-modal__error">
            <span className="video-modal__error-icon">
              <MotionIcon motion="pulse" active>
                <PlayIcon size={34} />
              </MotionIcon>
            </span>
            <h2>이 형식은 내장 디코더에서 재생할 수 없습니다</h2>
            <p>
              MP4/H.264, WebM처럼 WebView2가 지원하는 형식은 Novus 안에서 바로 재생됩니다. MKV나
              HEVC 등은 설치된 시스템 플레이어가 필요할 수 있습니다.
            </p>
            <GlassButton variant="primary" onClick={handleExternalFallback} isLoading={isPlaying}>
              시스템 플레이어로 열기
            </GlassButton>
          </div>
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

      {feedback && <div className="video-modal__feedback">{feedback.message}</div>}
    </div>
  );
};
