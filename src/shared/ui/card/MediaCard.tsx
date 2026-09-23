import React, { forwardRef, useState } from "react";
import { getBundledBrandAssetUrl } from "../../lib";
import { getBuiltinBrandLogo } from "../icons";

export interface MediaCardProps {
  id: string;
  title: string;
  category?: string;
  imageUrl?: string;
  iconUrl?: string;
  imageFit?: "cover" | "contain" | "auto";
  icon?: React.ReactNode;
  bannerUrl?: string;
  onClick?: () => void;
  accentColor?: string;
}

/**
 * Commercial-grade 16:9 TV tile card.
 * Priority chain:
 * 1. Explicit `imageUrl` (or `iconUrl`) - rendered full-bleed to fill the card
 * 2. User-added local asset in `src/assets/brands/[id].*` - rendered full-bleed
 * 3. Built-in vector SVG logo (`getBuiltinBrandLogo`)
 * 4. Fallback to clean bold text
 */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(
  (
    {
      id,
      title,
      imageUrl,
      iconUrl,
      imageFit = "auto",
      icon,
      bannerUrl,
      onClick,
      accentColor = "var(--color-primary)",
    },
    ref,
  ) => {
    const primaryUrl = imageUrl || iconUrl;
    const bundledAssetUrl = getBundledBrandAssetUrl(id);
    const BuiltinLogo = getBuiltinBrandLogo(id);

    // Track failed image URLs and auto-detected fit
    const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
    const [detectedFit, setDetectedFit] = useState<"cover" | "contain" | null>(null);

    const isPrimaryFailed = primaryUrl ? !!failedUrls[primaryUrl] : false;
    const isAssetFailed = bundledAssetUrl ? !!failedUrls[bundledAssetUrl] : false;

    let activeImgSrc: string | null = null;
    if (primaryUrl && !isPrimaryFailed) {
      activeImgSrc = primaryUrl;
    } else if (bundledAssetUrl && !isAssetFailed) {
      activeImgSrc = bundledAssetUrl;
    }

    const resolvedFit: "cover" | "contain" =
      imageFit === "contain" || imageFit === "cover" ? imageFit : (detectedFit ?? "cover");

    const handleImgError = (src: string) => {
      setFailedUrls((prev) => ({ ...prev, [src]: true }));
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (imageFit === "contain" || imageFit === "cover") return;
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Standard TV card is ~1.78 (16:9).
        // Wide wordmarks (e.g. TVING ratio 4.08, WATCHA ratio 2.86) or tall/square logos (ratio < 1.3)
        // should be contained within card boundaries rather than cropped.
        if (ratio > 2.1 || ratio < 1.3) {
          setDetectedFit("contain");
        } else {
          setDetectedFit("cover");
        }
      }
    };

    return (
      <div
        ref={ref}
        tabIndex={0}
        role="button"
        className={`media-card ${activeImgSrc ? "media-card--has-image" : ""} ${
          activeImgSrc ? `media-card--image-${resolvedFit}` : ""
        }`}
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
        {bannerUrl && (
          <div className="media-card__banner" style={{ backgroundImage: `url(${bannerUrl})` }} />
        )}

        {/* Card image showcase */}
        {activeImgSrc ? (
          <img
            src={activeImgSrc}
            alt={title}
            className={`media-card__cover-img media-card__cover-img--${resolvedFit}`}
            onLoad={handleImageLoad}
            onError={() => handleImgError(activeImgSrc!)}
          />
        ) : (
          /* Center Logomark Showcase for SVG / Text */
          <div className="media-card__showcase">
            {icon ? (
              <div className="media-card__brand-logo">{icon}</div>
            ) : BuiltinLogo ? (
              <div className="media-card__brand-logo">
                <BuiltinLogo width={130} height={38} />
              </div>
            ) : (
              <span className="media-card__text-logo">{title}</span>
            )}
          </div>
        )}

        {/* Title reveal on hover / focus */}
        <div className="media-card__reveal-bar">
          <span className="media-card__reveal-name">{title}</span>
        </div>
      </div>
    );
  },
);

MediaCard.displayName = "MediaCard";
