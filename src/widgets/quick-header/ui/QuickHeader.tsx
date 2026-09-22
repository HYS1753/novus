import React from "react";
import { useCurrentTime, toggleFullscreen, TouchButton } from "@/shared";

export const QuickHeader: React.FC = () => {
  const { time, date } = useCurrentTime();

  return (
    <header className="quick-header">
      <div className="quick-header__branding">
        <span className="quick-header__logo">NOVUS</span>
        <span className="quick-header__badge">SURFACE OS</span>
      </div>

      <div className="quick-header__center">
        <span className="quick-header__time">{time}</span>
        <span className="quick-header__date">{date}</span>
      </div>

      <div className="quick-header__actions">
        <TouchButton
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          aria-label="Toggle Fullscreen"
        >
          ⛶
        </TouchButton>
      </div>
    </header>
  );
};
