import React from "react";
import { motionOf } from "./iconMotion";

export type NvButtonVariant = "primary" | "secondary" | "quiet";

export interface NvButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: React.Ref<HTMLButtonElement>;
  variant?: NvButtonVariant;
  /** White-on-photo styling for buttons that sit over media or a scrim. */
  onMedia?: boolean;
  icon?: React.ReactNode;
  /** Large size for the primary action of a frame (e.g. "이어서 보기"). */
  size?: "regular" | "large";
}

/** Rectangular action that belongs to the content it sits on. */
export const NvButton: React.FC<NvButtonProps> = ({
  variant = "secondary",
  onMedia = false,
  icon,
  size = "regular",
  className = "",
  children,
  type = "button",
  ...props
}) => (
  <button
    type={type}
    className={`nv-button nv-button--${variant} nv-button--${size}${onMedia ? " nv-on-media" : ""} ${className}`}
    {...props}
  >
    {icon && (
      <span className="nv-button__icon" aria-hidden="true" data-motion={motionOf(icon)}>
        {icon}
      </span>
    )}
    <span className="nv-button__label">{children}</span>
  </button>
);
