import React from "react";

export interface MediaCardProps {
  id: string;
  title: string;
  category?: string;
  iconUrl?: string;
  bannerUrl?: string;
  onClick?: () => void;
  accentColor?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  title,
  category,
  iconUrl,
  bannerUrl,
  onClick,
  accentColor = "#3b82f6",
}) => {
  return (
    <div
      tabIndex={0}
      role="button"
      className="media-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        ["--accent-color" as string]: accentColor,
      }}
    >
      {bannerUrl ? (
        <div className="media-card__banner" style={{ backgroundImage: `url(${bannerUrl})` }} />
      ) : (
        <div className="media-card__placeholder">
          {iconUrl ? <img src={iconUrl} alt={title} className="media-card__icon" /> : null}
        </div>
      )}
      <div className="media-card__content">
        {category && <span className="media-card__category">{category}</span>}
        <h3 className="media-card__title">{title}</h3>
      </div>
    </div>
  );
};
