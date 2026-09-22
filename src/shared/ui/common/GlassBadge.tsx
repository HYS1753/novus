import React from "react";

export interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "neutral" | "accent" | "outline";
  size?: "sm" | "md";
  pulse?: boolean;
  children: React.ReactNode;
}

/** Compact status / category label. */
export const GlassBadge: React.FC<GlassBadgeProps> = ({
  variant = "neutral",
  size = "sm",
  pulse = false,
  className = "",
  children,
  ...props
}) => {
  return (
    <span
      className={`glass-badge glass-badge--${variant} glass-badge--${size} ${className}`}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="motion-pulse-dot absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
};

GlassBadge.displayName = "GlassBadge";
