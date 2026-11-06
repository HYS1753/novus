import React from "react";
import type { AppItem } from "@/entities";
import type { DockPosition } from "@/shared";
import {
  ExternalLinkIcon,
  MotionIcon,
  SettingsIcon,
  SubpageDock,
  TouchButton,
  useI18n,
} from "@/shared";

export interface InAppDockProps {
  app: AppItem;
  dockPosition: DockPosition;
  onHome: () => void;
  onBack: () => void;
  onReload: () => void;
  onOpenExternal?: () => void;
  onOpenSettings?: () => void;
}

/** Streaming-specific actions composed onto the shared internal-page dock. */
export const InAppDock: React.FC<InAppDockProps> = ({
  app,
  dockPosition,
  onHome,
  onBack,
  onReload,
  onOpenExternal,
  onOpenSettings,
}) => {
  const { t } = useI18n();
  return (
    <SubpageDock
      title={app.title}
      dockPosition={dockPosition}
      onHome={onHome}
      onBack={onBack}
      onReload={onReload}
      toolsSlot={
        <>
          {onOpenSettings && (
            <TouchButton
              variant="ghost"
              size="sm"
              className="in-app-dock__btn"
              onClick={onOpenSettings}
              aria-label={t("common.settings")}
              title={t("common.settings")}
            >
              <MotionIcon motion="rotate">
                <SettingsIcon size={20} />
              </MotionIcon>
            </TouchButton>
          )}
          {onOpenExternal && (
            <TouchButton
              variant="ghost"
              size="sm"
              className="in-app-dock__btn"
              onClick={onOpenExternal}
              aria-label={t("dock.openExternal")}
              title={t("dock.openExternal")}
            >
              <MotionIcon motion="nudge-right">
                <ExternalLinkIcon size={18} />
              </MotionIcon>
            </TouchButton>
          )}
        </>
      }
    />
  );
};
