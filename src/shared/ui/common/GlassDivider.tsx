import React from "react";

export interface GlassDividerProps {
  orientation?: "horizontal" | "vertical";
  /** Optional caption rendered inline. */
  label?: string;
  /** Alignment of the label. Defaults to "left". */
  align?: "left" | "center";
  /** Size variant for labelled divider. Defaults to "lg". */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Hairline separator or labelled category divider between groups of content. */
export const GlassDivider: React.FC<GlassDividerProps> = ({
  orientation = "horizontal",
  label,
  align = "left",
  size = "lg",
  className = "",
}) => {
  if (orientation === "vertical") {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={`glass-divider glass-divider--vertical ${className}`}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        className={`glass-divider glass-divider--labelled glass-divider--align-${align} glass-divider--size-${size} ${className}`}
      >
        <span className="glass-divider__label">{label}</span>
      </div>
    );
  }

  return <hr className={`glass-divider ${className}`} />;
};

GlassDivider.displayName = "GlassDivider";
