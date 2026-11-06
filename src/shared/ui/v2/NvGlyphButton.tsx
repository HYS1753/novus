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
  /** Second line under the label, e.g. "준비 중" for a feature not built yet. */
  hint?: string;
  /** Quieter tone for an entry point whose feature is not available yet. */
  muted?: boolean;
}

/** Circular global action: reachable from anywhere, never tied to one piece of content. */
export const NvGlyphButton: React.FC<NvGlyphButtonProps> = ({
  icon,
  label,
  showLabel = true,
  onMedia = false,
  hint,
  muted = false,
  className = "",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    aria-label={showLabel ? (hint ? `${label}, ${hint}` : undefined) : label}
    className={`nv-glyph${onMedia ? " nv-glyph--media nv-on-media" : ""}${muted ? " nv-glyph--muted" : ""} ${className}`}
    {...props}
  >
    <span className="nv-glyph__circle" aria-hidden="true">
      {icon}
    </span>
    {showLabel && (
      <span className="nv-glyph__label" aria-hidden={hint ? true : undefined}>
        {label}
        {hint && <span className="nv-glyph__hint">{hint}</span>}
      </span>
    )}
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
