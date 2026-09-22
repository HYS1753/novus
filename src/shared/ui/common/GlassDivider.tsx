import React from "react";

export interface GlassDividerProps {
  orientation?: "horizontal" | "vertical";
  /** Optional caption rendered inline, centred on a horizontal rule. */
  label?: string;
  className?: string;
}

/** Hairline separator between groups of content. */
export const GlassDivider: React.FC<GlassDividerProps> = ({
  orientation = "horizontal",
  label,
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
      <div role="separator" className={`glass-divider glass-divider--labelled ${className}`}>
        <span className="glass-divider__label">{label}</span>
      </div>
    );
  }

  return <hr className={`glass-divider ${className}`} />;
};

GlassDivider.displayName = "GlassDivider";
