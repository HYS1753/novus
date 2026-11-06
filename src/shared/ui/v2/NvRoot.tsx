import React, { useEffect, useRef } from "react";
import { useI18n } from "../../hooks/useI18n";
import { usePreference } from "../../hooks/usePreference";
import { useSpatialNavigation } from "../../hooks/useSpatialNavigation";

export interface NvRootProps {
  children: React.ReactNode;
  className?: string;
  /** Pins the posture for this subtree (onboarding previews postures without rescaling itself). */
  postureOverride?: "tablet" | "tv";
  /** Turn arrow-key navigation off for surfaces that own their keys (e.g. video). */
  spatialNavigation?: boolean;
  /** Scale sizes with the window height (off for nested roots and fixed-size previews). */
  scaleWithViewport?: boolean;
}

/** Reference frame height: Surface Pro 4 at 200% (1368×912 CSS px). */
const REFERENCE_HEIGHT = 912;
const MIN_VSCALE = 0.82;
const MAX_VSCALE = 1.6;

/**
 * The one element every v2 surface renders inside. It applies the stored
 * theme, posture, and language, hosts overlay portals, and drives arrow-key
 * spatial navigation.
 */
export const NvRoot: React.FC<NvRootProps> = ({
  children,
  className = "",
  postureOverride,
  spatialNavigation = true,
  scaleWithViewport = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [theme] = usePreference("theme");
  const [posture] = usePreference("posture");
  const { locale } = useI18n();
  useSpatialNavigation(ref, spatialNavigation);

  // Viewport scale: the 1368×912 reference frame scaled by window height.
  useEffect(() => {
    if (!scaleWithViewport) return;
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const vscale = Math.min(
        MAX_VSCALE,
        Math.max(MIN_VSCALE, window.innerHeight / REFERENCE_HEIGHT),
      );
      node.style.setProperty("--nv-vscale", vscale.toFixed(4));
    };
    const onResize = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [scaleWithViewport]);

  return (
    <div
      ref={ref}
      className={`nv-root ${className}`}
      data-theme={theme === "system" ? undefined : theme}
      data-posture={postureOverride ?? posture}
      data-nv-portal
      lang={locale}
    >
      {children}
    </div>
  );
};
