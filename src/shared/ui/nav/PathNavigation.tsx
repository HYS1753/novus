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
  const hiddenItems = items.slice(0, -2);
  const visibleItems = items.slice(-2);

  return (
    <div className={`path-navigation ${className}`}>
      <button
        type="button"
        className="path-navigation__up"
        onClick={onUp}
        disabled={!canGoUp}
        aria-label="상위 폴더로 이동"
        title="상위 폴더"
      >
        <MotionIcon motion="nudge-up">
          <ArrowUpIcon size={18} />
        </MotionIcon>
        <span>상위</span>
      </button>

      {hiddenItems.length > 0 && (
        <GlassMenu
          align="start"
          trigger={
            <button
              type="button"
              className="path-navigation__ellipsis"
              aria-label="앞쪽 경로 보기"
              title="앞쪽 경로 보기"
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

      <nav className="path-navigation__breadcrumbs" aria-label="현재 폴더 경로">
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
