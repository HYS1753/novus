import React from "react";
import novusLogoUrl from "@/assets/novus-logo.png";

export interface NovusLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Rendered height (px number or any CSS length); width follows the 779×260 ratio. */
  height?: number | string;
  className?: string;
}

const RATIO = 779 / 260;

/**
 * The official novus lockup (NV mark + wordmark) from `src/assets/novus-logo.png`.
 * The white artwork is used as a mask, so the logo takes the current text
 * colour: white over photos, ink on light grounds.
 */
export const NovusLogo: React.FC<NovusLogoProps> = ({
  height = 34,
  className = "",
  style,
  ...props
}) => (
  <span
    role="img"
    aria-label="novus"
    className={`novus-logo ${className}`}
    style={{
      display: "inline-block",
      flex: "none",
      height,
      aspectRatio: String(RATIO),
      backgroundColor: "var(--nv-logo-color, var(--nv-text, var(--color-text-primary)))",
      WebkitMaskImage: `url(${novusLogoUrl})`,
      maskImage: `url(${novusLogoUrl})`,
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "left center",
      maskPosition: "left center",
      ...style,
    }}
    {...props}
  />
);
