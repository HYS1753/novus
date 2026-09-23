import React, { useState, useEffect, useRef } from "react";
import {
  useCurrentTime,
  toggleFullscreen,
  GlassButton,
  CloudSunIcon,
  SettingsIcon,
  FullscreenIcon,
  ThemeIcon,
  SearchIcon,
  CloseIcon,
  MotionIcon,
} from "@/shared";
import novusLogo from "@/assets/novus-logo.png";

export interface QuickHeaderProps {
  onOpenSettings?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const QuickHeader: React.FC<QuickHeaderProps> = ({
  onOpenSettings,
  searchQuery = "",
  onSearchChange,
}) => {
  const { time, date } = useCurrentTime();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  };

  const handleToggleSearch = () => {
    setIsSearchExpanded((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else {
        onSearchChange?.("");
      }
      return next;
    });
  };

  // Close search when clicking outside
  useEffect(() => {
    if (!isSearchExpanded) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchExpanded(false);
        onSearchChange?.("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isSearchExpanded, onSearchChange]);

  return (
    <header className="quick-header">
      {/* Left: Clean Brand Logo */}
      <div className="quick-header__branding">
        <img
          src={novusLogo}
          alt="novus"
          className="quick-header__logo-img"
          style={{ height: "38px", width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Right Column: 2-Row Stack */}
      <div className="quick-header__right-column">
        {/* Row 1: Borderless, Elegant Time & Weather Typography */}
        <div className="quick-header__status-row" aria-label="현재 시간 및 날씨">
          <span className="quick-header__status-time">{time}</span>
          <span className="quick-header__status-dot">·</span>
          <span className="quick-header__status-date">{date}</span>
          <span className="quick-header__status-dot">·</span>
          <div className="quick-header__status-weather">
            <CloudSunIcon size={18} className="quick-header__weather-icon" />
            <span className="quick-header__status-temp">21°C</span>
            <span className="quick-header__status-city">서울</span>
          </div>
        </div>

        {/* Row 2: Expandable Search + Borderless Icon Actions */}
        <div className="quick-header__actions-row">
          {/* Search container wrapping search input & trigger */}
          <div ref={searchContainerRef} className="quick-header__search-group">
            {/* Smooth Expandable Search Input */}
            <div
              className={`quick-header__search-wrap ${
                isSearchExpanded ? "quick-header__search-wrap--open" : ""
              }`}
            >
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="앱 또는 기능 검색..."
                className="quick-header__search-input"
                aria-label="앱 및 기능 검색"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchExpanded(false);
                    onSearchChange?.("");
                  }
                }}
              />
              {isSearchExpanded && searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.("")}
                  className="quick-header__search-clear"
                  aria-label="검색어 초기화"
                >
                  <MotionIcon motion="pop">
                    <CloseIcon size={12} />
                  </MotionIcon>
                </button>
              )}
            </div>

            {/* Search Trigger Button */}
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={handleToggleSearch}
              aria-label={isSearchExpanded ? "검색창 닫기" : "검색창 열기"}
              title="검색"
              className={`quick-header__icon-btn quick-header__icon-btn--search ${
                isSearchExpanded ? "quick-header__icon-btn--active" : ""
              }`}
            >
              <MotionIcon motion="pop">
                <SearchIcon size={18} />
              </MotionIcon>
            </GlassButton>
          </div>

          <GlassButton
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
            title={isDark ? "라이트 모드" : "다크 모드"}
            className="quick-header__icon-btn quick-header__icon-btn--theme"
          >
            <MotionIcon motion="tilt">
              <ThemeIcon size={18} isDark={isDark} />
            </MotionIcon>
          </GlassButton>

          <GlassButton
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            aria-label="전체화면 전환"
            title="전체화면"
            className="quick-header__icon-btn quick-header__icon-btn--fullscreen"
          >
            <MotionIcon motion="pop">
              <FullscreenIcon size={18} />
            </MotionIcon>
          </GlassButton>

          {onOpenSettings && (
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              aria-label="대시보드 설정 열기"
              title="설정"
              className="quick-header__icon-btn quick-header__icon-btn--settings"
            >
              <MotionIcon motion="rotate">
                <SettingsIcon size={18} />
              </MotionIcon>
            </GlassButton>
          )}
        </div>
      </div>
    </header>
  );
};
