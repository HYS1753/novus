import React from "react";
import { RunningApps } from "@/shared/ui/nav/RunningApps";
import { toggleFullscreen } from "@/shared/api/tauri/window";
import { useDisplayMode } from "@/shared/hooks/useDisplayMode";
import { FullscreenIcon } from "@/shared/ui/icons";
import { useNow } from "../../hooks/useNow";
import { useI18n } from "@/shared/hooks/useI18n";
import { ArrowLeftIcon, HomeIcon, RefreshIcon } from "../icons";
import type { DockPosition } from "../../types";
import "./dock.css";

export interface SubpageDockProps {
  title: string;
  dockPosition: DockPosition;
  onHome: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  backLabel?: string;
  onReload?: () => void;
  toolsSlot?: React.ReactNode;
}

export interface DockToolProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
}

/** A quiet glyph on the rail: no platter at rest, a circle only on hover, focus, or press. */
export const DockTool: React.FC<DockToolProps> = ({ label, icon, className = "", ...props }) => (
  <button
    type="button"
    className={`nvd__tool ${className}`}
    aria-label={label}
    title={label}
    {...props}
  >
    {icon}
  </button>
);

/**
 * The theater rail beside every internal page (streaming, gallery, finder).
 * The streaming page is a native view that nothing can float over, so the
 * rail sits beside it like a TV bezel: always dark, the clock and the page
 * name on top, running services as plates (Stage Manager style), quiet tool
 * glyphs, and back + home at the end, within thumb reach.
 */
export const SubpageDock: React.FC<SubpageDockProps> = ({
  title,
  dockPosition,
  onHome,
  onBack,
  canGoBack = true,
  backLabel,
  onReload,
  toolsSlot,
}) => {
  const { t, time: formatTime } = useI18n();
  const time = formatTime(useNow());
  const { appFullscreen } = useDisplayMode();

  return (
    <aside className={`nvd nvd--${dockPosition}`} aria-label={t("dock.label", { title })}>
      <div className="nvd__now">
        <span className="nvd__time" aria-label={t("dock.time", { time })}>
          {time}
        </span>
        <span className="nvd__title">{title}</span>
      </div>

      <RunningApps />

      <div className="nvd__tools">
        {onReload && (
          <DockTool
            label={t("common.refresh")}
            icon={<RefreshIcon size={20} />}
            onClick={onReload}
          />
        )}
        <DockTool
          label={appFullscreen ? t("dock.fullscreenOffHint") : t("dock.fullscreenOnHint")}
          aria-pressed={appFullscreen}
          icon={<FullscreenIcon size={20} isFullscreen={appFullscreen} />}
          onClick={toggleFullscreen}
        />
        {toolsSlot}
      </div>

      <div className="nvd__nav">
        {onBack && (
          <button
            type="button"
            className="nvd__circle"
            onClick={onBack}
            disabled={!canGoBack}
            aria-label={backLabel ?? t("dock.back")}
            title={backLabel ?? t("dock.back")}
          >
            <ArrowLeftIcon size={22} />
          </button>
        )}
        <button
          type="button"
          className="nvd__circle nvd__circle--home"
          onClick={onHome}
          aria-label={t("dock.home")}
          title={t("dock.homeHint")}
        >
          <HomeIcon size={24} />
        </button>
      </div>
    </aside>
  );
};
