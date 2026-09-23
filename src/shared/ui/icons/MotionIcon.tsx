import React from "react";

export type IconMotionPreset =
  | "none"
  | "pop"
  | "rotate"
  | "tilt"
  | "nudge-left"
  | "nudge-right"
  | "nudge-up"
  | "pulse"
  | "spin"
  | "breathe";

export interface MotionIconProps {
  children: React.ReactNode;
  motion?: IconMotionPreset;
  active?: boolean;
  className?: string;
}

/**
 * Applies one design-system icon motion recipe without changing the SVG.
 * Interaction recipes respond to the nearest button/link hover and focus;
 * status recipes (`spin`, `pulse`, `breathe`) run only while `active`.
 */
export const MotionIcon: React.FC<MotionIconProps> = ({
  children,
  motion = "none",
  active = false,
  className = "",
}) => (
  <span
    className={`motion-icon motion-icon--${motion} ${active ? "motion-icon--active" : ""} ${className}`}
    aria-hidden="true"
  >
    {children}
  </span>
);

MotionIcon.displayName = "MotionIcon";
