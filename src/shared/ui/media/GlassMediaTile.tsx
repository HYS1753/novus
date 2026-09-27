import React from "react";
import { ArchiveIcon, DocumentIcon, FolderIcon, ImageIcon, MotionIcon, PlayIcon } from "../icons";

export interface GlassMediaTileProps {
  title: string;
  typeLabel?: string;
  sizeLabel?: string;
  thumbnailUrl?: string;
  category: "image" | "video" | "directory" | "document" | "archive" | "audio" | "other";
  onClick?: () => void;
  className?: string;
}

/** Standard 1:1 full-cover media surface with a compact metadata strip. */
export const GlassMediaTile: React.FC<GlassMediaTileProps> = React.memo(
  ({ title, typeLabel, sizeLabel, thumbnailUrl, category, onClick, className = "" }) => {
    const metadata = [title, typeLabel, sizeLabel].filter(Boolean).join(" ∙ ");
    const fallbackIcon = (() => {
      if (category === "directory") return <FolderIcon size={54} />;
      if (category === "video") return <PlayIcon size={28} />;
      if (category === "document") return <DocumentIcon size={46} />;
      if (category === "archive") return <ArchiveIcon size={46} />;
      return <ImageIcon size={46} />;
    })();

    return (
      <button
        type="button"
        onClick={onClick}
        className={`glass-media-tile glass-media-tile--${category} ${className}`}
        aria-label={metadata}
        title={metadata}
      >
        <span className="glass-media-tile__visual">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="glass-media-tile__image"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <span className="glass-media-tile__fallback" aria-hidden="true">
              <MotionIcon motion="pop">{fallbackIcon}</MotionIcon>
            </span>
          )}

          {category === "video" && thumbnailUrl && (
            <span className="glass-media-tile__play" aria-hidden="true">
              <MotionIcon motion="pop">
                <PlayIcon size={20} />
              </MotionIcon>
            </span>
          )}
        </span>

        <span className="glass-media-tile__meta">
          <span className="glass-media-tile__meta-line">{title}</span>
          {(typeLabel || sizeLabel) && (
            <span className="glass-media-tile__meta-detail">
              {[typeLabel, sizeLabel].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      </button>
    );
  },
);

GlassMediaTile.displayName = "GlassMediaTile";
