import React from "react";
import {
  GlassProgress,
  GlassBadge,
  GlassButton,
  ExternalLinkIcon,
  RefreshIcon,
  HomeIcon,
  MotionIcon,
  getBundledBrandAssetUrl,
  getBuiltinBrandLogo,
  useI18n,
} from "@/shared";
import type { AppItem } from "@/entities";

export interface InAppLoaderProps {
  app: AppItem;
  isLoading: boolean;
  showFallbackNotice?: boolean;
  onReload: () => void;
  onOpenExternal: () => void;
  onClose: () => void;
}

export const InAppLoader: React.FC<InAppLoaderProps> = ({
  app,
  isLoading,
  showFallbackNotice = false,
  onReload,
  onOpenExternal,
  onClose,
}) => {
  const { t } = useI18n();
  const bundledAsset = getBundledBrandAssetUrl(app.id);
  const logoUrl = app.imageUrl || bundledAsset;
  const BuiltinLogo = getBuiltinBrandLogo(app.id);

  return (
    <div
      className={`in-app-loader ${isLoading ? "in-app-loader--active" : "in-app-loader--hidden"}`}
      aria-hidden={!isLoading}
      aria-live="polite"
    >
      <div className="in-app-loader__backdrop" />

      <div className="in-app-loader__card">
        {/* Brand Icon with ambient glow */}
        <div
          className="in-app-loader__icon-wrapper"
          style={{
            ["--app-glow" as string]: app.accentColor || "var(--color-primary)",
          }}
        >
          <MotionIcon motion="breathe" active>
            {logoUrl ? (
              <img src={logoUrl} alt={app.title} className="in-app-loader__logo-img" />
            ) : BuiltinLogo ? (
              React.createElement(BuiltinLogo, { size: 48 })
            ) : (
              <span className="in-app-loader__logo-text">{app.title.slice(0, 2)}</span>
            )}
          </MotionIcon>
        </div>

        {/* Title & Status */}
        <div className="in-app-loader__meta">
          <div className="in-app-loader__badge-row">
            <GlassBadge variant="primary" pulse>
              {t("loader.connecting")}
            </GlassBadge>
          </div>
          <h2 className="in-app-loader__title">{app.title}</h2>
          <p className="in-app-loader__subtitle">
            {showFallbackNotice ? t("loader.checking") : t("loader.linking")}
          </p>
        </div>

        {/* Design Guide Linear Indeterminate Progress */}
        <div className="in-app-loader__progress">
          <GlassProgress tone="primary" />
        </div>

        {/* Quick Launch Button available immediately */}
        <div className="in-app-loader__quick-row">
          <GlassButton variant="primary" size="sm" onClick={onOpenExternal}>
            <MotionIcon motion="nudge-right">
              <ExternalLinkIcon size={16} />
            </MotionIcon>
            {t("loader.openStandalone")}
          </GlassButton>
        </div>

        {/* Fallback Notice & Direct Options (shown if loading takes longer or is blocked) */}
        {showFallbackNotice && (
          <div className="in-app-loader__fallback">
            <p className="in-app-loader__fallback-desc">{t("loader.drmHint")}</p>
            <div className="in-app-loader__fallback-actions">
              <GlassButton variant="secondary" size="sm" onClick={onReload}>
                <MotionIcon motion="rotate">
                  <RefreshIcon size={16} />
                </MotionIcon>
                {t("common.retry")}
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={onClose}>
                <MotionIcon motion="pop">
                  <HomeIcon size={16} />
                </MotionIcon>
                {t("common.home")}
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
