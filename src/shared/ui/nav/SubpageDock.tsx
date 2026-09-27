import React from "react";
import { useCurrentTime } from "../../hooks";
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
  backLabel = "이전 화면으로 이동",
  onReload,
  toolsSlot,
}) => {
  const { time } = useCurrentTime();

  return (
    <aside
      className={`in-app-dock in-app-dock--${dockPosition}`}
      aria-label={`${title} 시스템 독`}
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
            aria-label="새로고침"
            title="새로고침"
          >
            <MotionIcon motion="rotate">
              <RefreshIcon size={18} />
            </MotionIcon>
          </TouchButton>
        )}

        {toolsSlot}
      </div>

      {/* Center: Clean Subpage Title */}
      <div className="in-app-dock__app-info">
        <span className="in-app-dock__app-title">{title}</span>
      </div>

      {/* Bottom Cluster: Home, Back, and Clock */}
      <div className="in-app-dock__cluster in-app-dock__cluster--nav">
        <TouchButton
          variant="ghost"
          size="sm"
          className="in-app-dock__btn in-app-dock__btn--home"
          onClick={onHome}
          aria-label="대시보드 홈으로 이동"
          title="대시보드 홈으로 이동 (ESC)"
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
            aria-label={backLabel}
            title={backLabel}
          >
            <MotionIcon motion="nudge-left">
              <ArrowLeftIcon size={20} />
            </MotionIcon>
          </TouchButton>
        )}

        <div className="in-app-dock__time" aria-label={`현재 시각 ${time}`}>
          {time}
        </div>
      </div>
    </aside>
  );
};
