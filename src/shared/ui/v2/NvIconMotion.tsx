import React from "react";
import { motionOf } from "./iconMotion";

/**
 * Wraps an icon so it moves the way its function does when the button it
 * sits in is hovered, focused, or pressed (see `iconMotion.ts`).
 */
export const NvIconMotion: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="nv-motion" data-motion={motionOf(children)} aria-hidden="true">
    {children}
  </span>
);
