import React, { forwardRef } from "react";
import { MotionIcon, RefreshIcon } from "../icons";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}

/** Primary action control with 48px touch targets and press feedback. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = "glass",
      size = "md",
      fullWidth = false,
      isLoading = false,
      disabled = false,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={`glass-btn glass-btn--${variant} glass-btn--${size} ${fullWidth ? "glass-btn--full" : ""} ${className}`}
        {...props}
      >
        {/* Keep the label mounted so the button does not resize while busy. */}
        <span className={isLoading ? "glass-btn__label--busy" : undefined}>{children}</span>

        {isLoading && (
          <span className="glass-btn__spinner" aria-hidden="true">
            <MotionIcon motion="spin" active>
              <RefreshIcon size={16} />
            </MotionIcon>
          </span>
        )}
      </button>
    );
  },
);

GlassButton.displayName = "GlassButton";
