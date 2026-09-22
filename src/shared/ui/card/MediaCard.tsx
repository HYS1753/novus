import { forwardRef } from "react";

export interface MediaCardProps {
  id: string;
  title: string;
  category?: string;
  iconUrl?: string;
  bannerUrl?: string;
  onClick?: () => void;
  accentColor?: string;
}

export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(
  ({ title, category, iconUrl, bannerUrl, onClick, accentColor = "var(--color-primary)" }, ref) => {
    return (
      <div
        ref={ref}
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
            {iconUrl ? <img src={iconUrl} alt="" className="media-card__icon" /> : null}
          </div>
        )}
        <div className="media-card__content">
          {category ? <p className="media-card__category">{category}</p> : null}
          <h3 className="media-card__title">{title}</h3>
        </div>
      </div>
    );
  },
);

MediaCard.displayName = "MediaCard";
