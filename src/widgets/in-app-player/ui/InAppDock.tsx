import React from "react";
import type { AppItem } from "@/entities";
import type { DockPosition } from "@/shared";
import { DockTool, ExternalLinkIcon, SettingsIcon, SubpageDock, useI18n } from "@/shared";

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
          {onOpenExternal && (
            <DockTool
              label={t("dock.openExternal")}
              icon={<ExternalLinkIcon size={20} />}
              onClick={onOpenExternal}
            />
          )}
          {onOpenSettings && (
            <DockTool
              label={t("common.settings")}
              icon={<SettingsIcon size={20} />}
              onClick={onOpenSettings}
            />
          )}
        </>
      }
    />
  );
};
