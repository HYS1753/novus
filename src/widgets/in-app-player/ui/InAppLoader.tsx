import React from "react";
import {
  GlassProgress,
  GlassBadge,
  GlassButton,
  ExternalLinkIcon,
  RefreshIcon,
  HomeIcon,
  getBundledBrandAssetUrl,
  getBuiltinBrandLogo,
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
          {logoUrl ? (
            <img src={logoUrl} alt={app.title} className="in-app-loader__logo-img" />
          ) : BuiltinLogo ? (
            React.createElement(BuiltinLogo, { size: 48 })
          ) : (
            <span className="in-app-loader__logo-text">{app.title.slice(0, 2)}</span>
          )}
        </div>

        {/* Title & Status */}
        <div className="in-app-loader__meta">
          <div className="in-app-loader__badge-row">
            <GlassBadge variant="primary" pulse>
              연결 중
            </GlassBadge>
          </div>
          <h2 className="in-app-loader__title">{app.title}</h2>
          <p className="in-app-loader__subtitle">
            {showFallbackNotice
              ? "외부 스트리밍 보안 정책을 확인하고 있습니다..."
              : "보안 채널을 통해 스트리밍 뷰를 연결하고 있습니다."}
          </p>
        </div>

        {/* Design Guide Linear Indeterminate Progress */}
        <div className="in-app-loader__progress">
          <GlassProgress tone="primary" />
        </div>

        {/* Quick Launch Button available immediately */}
        <div className="in-app-loader__quick-row">
          <GlassButton variant="primary" size="sm" onClick={onOpenExternal}>
            <ExternalLinkIcon size={16} /> 독립 플레이어로 즉시 열기
          </GlassButton>
        </div>

        {/* Fallback Notice & Direct Options (shown if loading takes longer or is blocked) */}
        {showFallbackNotice && (
          <div className="in-app-loader__fallback">
            <p className="in-app-loader__fallback-desc">
              스트리밍 보안 정책(X-Frame-Options / Widevine DRM)으로 인해 인앱 프레임 표시가 제한될
              수 있습니다. 독립 플레이어 모드에서 1080p 고화질 하드웨어 가속으로 끊김 없이 감상하실
              수 있습니다.
            </p>
            <div className="in-app-loader__fallback-actions">
              <GlassButton variant="secondary" size="sm" onClick={onReload}>
                <RefreshIcon size={16} /> 다시 시도
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={onClose}>
                <HomeIcon size={16} /> 대시보드
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
