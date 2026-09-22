import React, { forwardRef } from "react";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  elevation?: "flat" | "raised" | "floating";
  children: React.ReactNode;
}

/** Glass surface container with elevation and optional interaction feedback. */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ interactive = false, elevation = "flat", className = "", children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`glass-card glass-card--${elevation} ${interactive ? "glass-card--interactive" : ""} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
