import { forwardRef } from "react";
import { GlassButton, type GlassButtonProps } from "../common/GlassButton";

export type TouchButtonProps = GlassButtonProps;

/**
 * TouchButton - Backwards-compatible touch-optimized button
 * Standardized to use the GlassButton design system implementation internally.
 */
export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>((props, ref) => {
  return <GlassButton ref={ref} {...props} />;
});

TouchButton.displayName = "TouchButton";
