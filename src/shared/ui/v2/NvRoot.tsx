import React, { useRef } from "react";
import { useI18n } from "../../hooks/useI18n";
import { usePreference } from "../../hooks/usePreference";
import { useSpatialNavigation } from "../../hooks/useSpatialNavigation";

export interface NvRootProps {
  children: React.ReactNode;
  className?: string;
  /** Turn arrow-key navigation off for surfaces that own their keys (e.g. video). */
  spatialNavigation?: boolean;
}

/**
 * The one element every v2 surface renders inside. It applies the stored
 * theme, posture, and language, hosts overlay portals, and drives arrow-key
 * spatial navigation.
 */
export const NvRoot: React.FC<NvRootProps> = ({
  children,
  className = "",
  spatialNavigation = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [theme] = usePreference("theme");
  const [posture] = usePreference("posture");
  const { locale } = useI18n();
  useSpatialNavigation(ref, spatialNavigation);

  return (
    <div
      ref={ref}
      className={`nv-root ${className}`}
      data-theme={theme === "system" ? undefined : theme}
      data-posture={posture}
      data-nv-portal
      lang={locale}
    >
      {children}
    </div>
  );
};
