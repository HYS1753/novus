import React from "react";
import { RunningApps } from "@/shared/ui/nav/RunningApps";
import { toggleFullscreen } from "@/shared/api/tauri/window";
import { useDisplayMode } from "@/shared/hooks/useDisplayMode";
import { FullscreenIcon } from "@/shared/ui/icons";
import { useNow } from "../../hooks/useNow";
import { useI18n } from "@/shared/hooks/useI18n";
import { ArrowLeftIcon, HomeIcon, MotionIcon, RefreshIcon } from "../icons";
import { TouchButton } from "../button";
import type { DockPosition } from "../../types";

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
    <aside
      className={`in-app-dock in-app-dock--${dockPosition}`}
      aria-label={t("dock.label", { title })}
      style={{ zIndex: 30 }}
    >
      {/* Top Cluster: Tools, Sorting & Reload */}
      <div className="in-app-dock__cluster in-app-dock__cluster--tools">
        {onReload && (
          <TouchButton
            variant="ghost"
            size="sm"
            className="in-app-dock__btn"
            onClick={onReload}
            aria-label={t("common.refresh")}
            title={t("common.refresh")}
          >
            <MotionIcon motion="rotate">
              <RefreshIcon size={18} />
            </MotionIcon>
          </TouchButton>
        )}

        {toolsSlot}
        <TouchButton
          variant="ghost"
          size="sm"
          className="in-app-dock__btn"
          onClick={toggleFullscreen}
          aria-label={appFullscreen ? t("dock.fullscreenOff") : t("dock.fullscreenOn")}
          aria-pressed={appFullscreen}
          title={appFullscreen ? t("dock.fullscreenOffHint") : t("dock.fullscreenOnHint")}
        >
          <MotionIcon motion="pop">
            <FullscreenIcon size={20} isFullscreen={appFullscreen} />
          </MotionIcon>
        </TouchButton>
      </div>

      {/* Center: Clean Subpage Title */}
      <div className="in-app-dock__app-info">
        <span className="in-app-dock__app-title">{title}</span>
        <RunningApps />
      </div>

      {/* Bottom Cluster: Home, Back, and Clock */}
      <div className="in-app-dock__cluster in-app-dock__cluster--nav">
        <TouchButton
          variant="ghost"
          size="sm"
          className="in-app-dock__btn in-app-dock__btn--home"
          onClick={onHome}
          aria-label={t("dock.home")}
          title={t("dock.homeHint")}
        >
          <MotionIcon motion="pop">
            <HomeIcon size={22} />
          </MotionIcon>
        </TouchButton>

        {onBack && (
          <TouchButton
            variant="ghost"
            size="sm"
            className="in-app-dock__btn"
            onClick={onBack}
            disabled={!canGoBack}
            aria-label={backLabel ?? t("dock.back")}
            title={backLabel ?? t("dock.back")}
          >
            <MotionIcon motion="nudge-left">
              <ArrowLeftIcon size={20} />
            </MotionIcon>
          </TouchButton>
        )}

        <div className="in-app-dock__time" aria-label={t("dock.time", { time })}>
          {time}
        </div>
      </div>
    </aside>
  );
};
