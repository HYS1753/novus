import React from "react";
import { ArrowUpIcon, MotionIcon } from "../icons";

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
}) => (
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

    <nav className="path-navigation__breadcrumbs" aria-label="현재 폴더 경로">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return (
          <React.Fragment key={item.path}>
            {index > 0 && <span className="path-navigation__separator">/</span>}
            {current ? (
              <span className="path-navigation__current" aria-current="location" title={item.path}>
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

PathNavigation.displayName = "PathNavigation";
