import React, { useState } from "react";
import { useCurrentTime, toggleFullscreen, TouchButton } from "@/shared";

export const QuickHeader: React.FC = () => {
  const { time, date } = useCurrentTime();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  };

  return (
    <header className="quick-header">
      <div className="quick-header__branding">
        <span className="quick-header__logo">NOVUS</span>
      </div>

      <div className="quick-header__center">
        <span className="quick-header__time">{time}</span>
        <span className="quick-header__date">{date}</span>
      </div>

      <div className="quick-header__actions">
        <TouchButton
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label="테마 전환"
          title="테마 전환"
        >
          {isDark ? "Dark" : "Light"}
        </TouchButton>

        <TouchButton
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          aria-label="전체화면"
          title="전체화면"
        >
          Full
        </TouchButton>
      </div>
    </header>
  );
};
