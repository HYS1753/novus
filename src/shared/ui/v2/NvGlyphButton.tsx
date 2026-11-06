import React from "react";

export interface NvGlyphButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon: React.ReactNode;
  label: string;
  /** Show the label under the circle. Hidden labels stay available to assistive tech. */
  showLabel?: boolean;
  onMedia?: boolean;
}

/** Circular global action: reachable from anywhere, never tied to one piece of content. */
export const NvGlyphButton: React.FC<NvGlyphButtonProps> = ({
  icon,
  label,
  showLabel = true,
  onMedia = false,
  className = "",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    aria-label={showLabel ? undefined : label}
    className={`nv-glyph${onMedia ? " nv-glyph--media nv-on-media" : ""} ${className}`}
    {...props}
  >
    <span className="nv-glyph__circle" aria-hidden="true">
      {icon}
    </span>
    {showLabel && <span className="nv-glyph__label">{label}</span>}
  </button>
);

export interface NvGlyphRailProps {
  children: React.ReactNode;
  label: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export const NvGlyphRail: React.FC<NvGlyphRailProps> = ({
  children,
  label,
  orientation = "vertical",
  className = "",
}) => (
  <nav aria-label={label} className={`nv-rail nv-rail--${orientation} ${className}`}>
    {children}
  </nav>
);
