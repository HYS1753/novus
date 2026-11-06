import React from "react";
import { ExternalLinkIcon, HomeIcon, NvBrandArt, NvButton, RefreshIcon, useI18n } from "@/shared";
import type { AppItem } from "@/entities";
import "./in-app-loader.css";

export interface InAppLoaderProps {
  app: AppItem;
  isLoading: boolean;
  showFallbackNotice?: boolean;
  onReload: () => void;
  onOpenExternal: () => void;
  onClose: () => void;
}

/**
 * The launch screen while a service connects: the service's own plate,
 * its name, one status line, a bloom and sheen as progress, and the standalone
 * escape. Centred on ground, the same world as today's page.
 */
export const InAppLoader: React.FC<InAppLoaderProps> = ({
  app,
  isLoading,
  showFallbackNotice = false,
  onReload,
  onOpenExternal,
  onClose,
}) => {
  const { t } = useI18n();

  return (
    <div
      className={`in-app-loader nvl ${isLoading ? "in-app-loader--active" : "in-app-loader--hidden"}`}
      aria-hidden={!isLoading}
      aria-live="polite"
    >
      <div className="nvl__stack">
        {/* The plate breathes over a blurred bloom of its own art while the service connects. */}
        <div className="nvl__media" role="progressbar" aria-label={t("loader.connecting")}>
          {/* The bloom is the service's colour as a soft radial light: no blur filter. */}
          <span
            className="nvl__glow"
            aria-hidden="true"
            style={{ color: app.accentColor || "var(--nv-text)" }}
          />
          <NvBrandArt id={app.id} name={app.title} className="nvl__art" />
          <span className="nvl__sheen" aria-hidden="true" />
        </div>

        <div className="nvl__meta">
          <h2 className="nvl__title">{app.title}</h2>
          <p className="nvl__status">
            {showFallbackNotice ? t("loader.checking") : t("loader.linking")}
          </p>
        </div>

        {showFallbackNotice && <p className="nvl__hint">{t("loader.drmHint")}</p>}

        <div className="nvl__actions">
          <NvButton
            variant="primary"
            icon={<ExternalLinkIcon size={18} />}
            onClick={onOpenExternal}
          >
            {t("loader.openStandalone")}
          </NvButton>
          {showFallbackNotice && (
            <>
              <NvButton icon={<RefreshIcon size={18} />} onClick={onReload}>
                {t("common.retry")}
              </NvButton>
              <NvButton variant="quiet" icon={<HomeIcon size={18} />} onClick={onClose}>
                {t("common.home")}
              </NvButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
