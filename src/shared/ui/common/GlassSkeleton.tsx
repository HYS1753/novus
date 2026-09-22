import React from "react";

export interface GlassSkeletonProps {
  variant?: "text" | "block" | "circle";
  width?: number | string;
  height?: number | string;
  /** Number of stacked lines; only meaningful for the text variant. */
  lines?: number;
  className?: string;
}

/**
 * Placeholder that holds the shape of content while it loads.
 * Always size it to the real content so nothing shifts on arrival.
 */
export const GlassSkeleton: React.FC<GlassSkeletonProps> = ({
  variant = "text",
  width,
  height,
  lines = 1,
  className = "",
}) => {
  const style: React.CSSProperties = {
    width: width ?? (variant === "circle" ? 40 : "100%"),
    height: height ?? (variant === "circle" ? 40 : undefined),
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className={`glass-skeleton-group ${className}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="glass-skeleton glass-skeleton--text"
            // Last line reads as a paragraph end rather than a full block.
            style={{ width: i === lines - 1 ? "62%" : "100%" }}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      className={`glass-skeleton glass-skeleton--${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

GlassSkeleton.displayName = "GlassSkeleton";
