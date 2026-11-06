import { useI18n } from "@/shared/hooks/useI18n";
import React from "react";
import { ArrowUpIcon, MotionIcon } from "../icons";
import { GlassMenu } from "../common";

export interface PathNavigationItem {
  label: string;
  path: string;
}

export interface PathNavigationProps {
  items: PathNavigationItem[];
  canGoUp: boolean;
  onUp: () => void;
  onNavigate: (path: string) => void;
  className?: string;
}

/** Shared filesystem navigation: parent action plus clickable ancestor path. */
export const PathNavigation: React.FC<PathNavigationProps> = ({
  items,
  canGoUp,
  onUp,
  onNavigate,
  className = "",
}) => {
  const { t } = useI18n();
  const hiddenItems = items.slice(0, -2);
  const visibleItems = items.slice(-2);

  return (
    <div className={`path-navigation ${className}`}>
      <button
        type="button"
        className="path-navigation__up"
        onClick={onUp}
        disabled={!canGoUp}
        aria-label={t("path.up")}
        title={t("path.upTitle")}
      >
        <MotionIcon motion="nudge-up">
          <ArrowUpIcon size={18} />
        </MotionIcon>
        <span>{t("path.upShort")}</span>
      </button>

      {hiddenItems.length > 0 && (
        <GlassMenu
          align="start"
          trigger={
            <button
              type="button"
              className="path-navigation__ellipsis"
              aria-label={t("path.more")}
              title={t("path.more")}
            >
              …
            </button>
          }
          items={hiddenItems.map((item) => ({
            id: item.path,
            label: item.label,
            onSelect: () => onNavigate(item.path),
          }))}
        />
      )}

      <nav className="path-navigation__breadcrumbs" aria-label={t("path.label")}>
        {visibleItems.map((item, index) => {
          const current = index === visibleItems.length - 1;
          return (
            <React.Fragment key={item.path}>
              {(index > 0 || hiddenItems.length > 0) && (
                <span className="path-navigation__separator">/</span>
              )}
              {current ? (
                <span
                  className="path-navigation__current"
                  aria-current="location"
                  title={item.path}
                >
                  {item.label}
                </span>
              ) : (
                <button type="button" onClick={() => onNavigate(item.path)} title={item.path}>
                  {item.label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

PathNavigation.displayName = "PathNavigation";
