import React from "react";
import {
  HomeIcon,
  ArrowLeftIcon,
  RefreshIcon,
  SettingsIcon,
  ExternalLinkIcon,
  useCurrentTime,
  TouchButton,
} from "@/shared";
import type { DockPosition } from "@/shared";
import type { AppItem } from "@/entities";

export interface InAppDockProps {
  app: AppItem;
  dockPosition: DockPosition;
  onHome: () => void;
  onBack: () => void;
  onReload: () => void;
  onOpenExternal?: () => void;
  onOpenSettings?: () => void;
}

export const InAppDock: React.FC<InAppDockProps> = ({
  app,
  dockPosition,
  onHome,
  onBack,
  onReload,
  onOpenExternal,
  onOpenSettings,
}) => {
  const { time } = useCurrentTime();

  return (
    <aside className={`in-app-dock in-app-dock--${dockPosition}`} aria-label="태블릿 시스템 독">
      {/* Top Cluster: Settings, Reload & External View */}
      <div className="in-app-dock__cluster in-app-dock__cluster--tools">
        {onOpenSettings && (
          <TouchButton
            variant="ghost"
            size="sm"
            className="in-app-dock__btn"
            onClick={onOpenSettings}
            aria-label="설정"
            title="설정"
          >
            <SettingsIcon size={20} />
          </TouchButton>
        )}

        <TouchButton
          variant="ghost"
          size="sm"
          className="in-app-dock__btn"
          onClick={onReload}
          aria-label="새로고침"
          title="새로고침"
        >
          <RefreshIcon size={18} />
        </TouchButton>

        {onOpenExternal && (
          <TouchButton
            variant="ghost"
            size="sm"
            className="in-app-dock__btn"
            onClick={onOpenExternal}
            aria-label="외부 브라우저로 열기"
            title="외부 브라우저로 열기"
          >
            <ExternalLinkIcon size={18} />
          </TouchButton>
        )}
      </div>

      {/* Center: Clean App Title (No accent dot) */}
      <div className="in-app-dock__app-info">
        <span className="in-app-dock__app-title">{app.title}</span>
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
          <HomeIcon size={22} />
        </TouchButton>

        <TouchButton
          variant="ghost"
          size="sm"
          className="in-app-dock__btn"
          onClick={onBack}
          aria-label="이전 페이지로 이동"
          title="이전 페이지로 이동"
        >
          <ArrowLeftIcon size={20} />
        </TouchButton>

        <div className="in-app-dock__time" aria-label={`현재 시각 ${time}`}>
          {time}
        </div>
      </div>
    </aside>
  );
};
