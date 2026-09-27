import React, { useState, useLayoutEffect, useRef, useCallback } from "react";
import { QuickHeader, MediaShelf, SettingsSheet, InAppPlayer } from "@/widgets";
import { GlassDivider, GlassModal, GlassButton, RemoteIcon, MoonIcon } from "@/shared";
import { useLaunchApp } from "@/features";
import type { AppItem } from "@/entities";
import { GalleryPage } from "../../gallery";
import { FinderPage } from "../../finder";

const STREAMING_APPS: AppItem[] = [
  {
    id: "netflix",
    title: "Netflix",
    category: "media",
    url: "https://www.netflix.com",
    imageUrl:
      "https://images.ctfassets.net/y2ske730sjqp/5QQ9SVIdc1tmkqrtFnG9U1/de758bba0f65dcc1c6bc1f31f161003d/BrandAssets_Logos_02-NSymbol.jpg?w=940",
    accentColor: "#E50914",
  },
  {
    id: "youtube",
    title: "YouTube",
    category: "media",
    url: "https://www.youtube.com",
    imageUrl:
      "https://www.gstatic.com/marketing-cms/assets/images/08/25/fffdc76145f28be3a1ca63859c4a/external-logo-core-1.png=n-w1860-h1047-fcrop64=1,00000000ffffffff-rw",
    accentColor: "#FF0000",
  },
  {
    id: "disney",
    title: "Disney+",
    category: "media",
    url: "https://www.disneyplus.com",
    imageUrl:
      "https://lumiere-a.akamaihd.net/v1/images/disney_logo_march_2024_050fef2e.png?region=0%2C0%2C1920%2C1080",
    accentColor: "#113CCF",
  },
  {
    id: "tving",
    title: "TVING",
    category: "media",
    url: "https://www.tving.com",
    accentColor: "#FF153C",
    imageFit: "contain",
  },
  {
    id: "wavve",
    title: "Wavve",
    category: "media",
    url: "https://www.wavve.com",
    accentColor: "#004FFF",
  },
  {
    id: "watcha",
    title: "Watcha",
    category: "media",
    url: "https://watcha.com",
    accentColor: "#FF0558",
    imageFit: "contain",
  },
  {
    id: "coupang",
    title: "Coupang Play",
    category: "media",
    url: "https://www.coupangplay.com",
    accentColor: "#00AFFF",
  },
];

const SMART_TOOLS: AppItem[] = [
  {
    id: "calendar",
    title: "Google Calendar",
    category: "tools",
    url: "https://calendar.google.com",
    accentColor: "#1A73E8",
  },
  {
    id: "radio",
    title: "Web Radio & BGM",
    category: "tools",
    url: "https://radio.garden",
    accentColor: "#8E24AA",
  },
  {
    id: "photos",
    title: "미디어 갤러리",
    category: "media",
    url: "#photos",
    accentColor: "#EC4899",
  },
  {
    id: "finder",
    title: "파일 파인더",
    category: "tools",
    url: "#finder",
    accentColor: "#3B82F6",
  },
  {
    id: "browser",
    title: "Quick Search",
    category: "tools",
    url: "https://www.google.com",
    accentColor: "#EA4335",
  },
];

const QUICK_CONTROLS: AppItem[] = [
  {
    id: "ambient",
    title: "Ambient Display",
    category: "system",
    url: "#ambient",
    accentColor: "#6366F1",
  },
  {
    id: "remote",
    title: "Mobile Remote",
    category: "system",
    url: "#remote",
    accentColor: "#10B981",
  },
];

const ALL_APPS = [...STREAMING_APPS, ...SMART_TOOLS, ...QUICK_CONTROLS];

export const DashboardPage: React.FC = () => {
  const [activeView, setActiveView] = useState<"dashboard" | "gallery" | "finder">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<AppItem | null>(null);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [isAmbientModalOpen, setIsAmbientModalOpen] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const { launchApp } = useLaunchApp();

  const updateScrollIndicators = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setCanScrollUp(scrollTop > 10);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
  }, []);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    updateScrollIndicators();

    el.addEventListener("scroll", updateScrollIndicators, { passive: true });
    window.addEventListener("resize", updateScrollIndicators);

    const resizeObserver = new ResizeObserver(updateScrollIndicators);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollIndicators);
      window.removeEventListener("resize", updateScrollIndicators);
      resizeObserver.disconnect();
    };
  }, [activeView, activeApp, updateScrollIndicators]);

  const isSearching = searchQuery.trim().length > 0;
  const filteredApps = isSearching
    ? ALL_APPS.filter(
        (app) =>
          app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const handleItemClick = (item: AppItem) => {
    if (item.id === "remote") {
      setIsRemoteModalOpen(true);
      return;
    }
    if (item.id === "ambient") {
      setIsAmbientModalOpen(true);
      return;
    }
    if (item.id === "photos") {
      setActiveView("gallery");
      return;
    }
    if (item.id === "finder") {
      setActiveView("finder");
      return;
    }
    if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
      setActiveApp(item);
      return;
    }
    launchApp(item);
  };

  // Dedicated In-App TV Player view
  if (activeApp) {
    return (
      <div className="dashboard-page dashboard-page--in-app-mode">
        <InAppPlayer
          key={activeApp.id}
          app={activeApp}
          onClose={() => setActiveApp(null)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

  // Dedicated Gallery view (Images & Videos)
  if (activeView === "gallery") {
    return <GalleryPage onBackToDashboard={() => setActiveView("dashboard")} />;
  }

  // Dedicated System Finder view (All files)
  if (activeView === "finder") {
    return <FinderPage onBackToDashboard={() => setActiveView("dashboard")} />;
  }

  return (
    <div className="dashboard-page">
      {/* Scroll indicator fades: indicates more content above or below */}
      <div
        className={`dashboard-page__scroll-fade dashboard-page__scroll-fade--top ${
          canScrollUp ? "dashboard-page__scroll-fade--visible" : ""
        }`}
        aria-hidden="true"
      />
      <div
        className={`dashboard-page__scroll-fade dashboard-page__scroll-fade--bottom ${
          canScrollDown ? "dashboard-page__scroll-fade--visible" : ""
        }`}
        aria-hidden="true"
      />

      <main ref={contentRef} className="dashboard-page__content">
        {/* Header with integrated expandable search, actions, and status */}
        <QuickHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {isSearching ? (
          <section className="dashboard-section">
            <GlassDivider label={`검색 결과 (${filteredApps.length})`} />
            <MediaShelf items={filteredApps} onItemClick={handleItemClick} />
          </section>
        ) : (
          <>
            {/* 섹션 1: 스트리밍 & 미디어 */}
            <section className="dashboard-section">
              <GlassDivider label="스트리밍 & 미디어" />
              <MediaShelf items={STREAMING_APPS} onItemClick={handleItemClick} />
            </section>

            {/* 섹션 2: 스마트 도구 & 허브 */}
            <section className="dashboard-section">
              <GlassDivider label="스마트 도구 & 허브" />
              <MediaShelf items={SMART_TOOLS} onItemClick={handleItemClick} />
            </section>

            {/* 섹션 3: 시스템 빠른 제어 */}
            <section className="dashboard-section">
              <GlassDivider label="시스템 빠른 제어" />
              <MediaShelf items={QUICK_CONTROLS} onItemClick={handleItemClick} />
            </section>
          </>
        )}
      </main>

      {/* 앱 설정 사이드 패널 */}
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 스마트폰 리모컨 QR 모달 */}
      <GlassModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        title="스마트폰 리모컨 연결"
        description="동일한 Wi-Fi에 연결된 스마트폰 카메라로 QR 코드를 스캔하세요."
        footer={
          <GlassButton variant="primary" size="md" onClick={() => setIsRemoteModalOpen(false)}>
            닫기
          </GlassButton>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            padding: "12px 0",
          }}
        >
          <div
            style={{
              width: "160px",
              height: "160px",
              background: "#FFFFFF",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--glass-shadow-raised)",
            }}
          >
            <RemoteIcon size={64} style={{ color: "#10B981" }} />
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: "13px",
              color: "var(--color-text-secondary)",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text-primary)" }}>
              로컬 연결 주소: http://192.168.0.15:1420/remote
            </p>
            <p style={{ margin: "4px 0 0 0" }}>
              침대나 소파에서 스마트폰으로 볼륨과 재생을 편리하게 제어합니다.
            </p>
          </div>
        </div>
      </GlassModal>

      {/* 앰비언트 대기 모드 안내 모달 */}
      <GlassModal
        isOpen={isAmbientModalOpen}
        onClose={() => setIsAmbientModalOpen(false)}
        title="앰비언트 대기 모드"
        description="화면 밝기를 최소화하고 저전력 탁상 시계 모드로 전환합니다."
        footer={
          <GlassButton variant="primary" size="md" onClick={() => setIsAmbientModalOpen(false)}>
            확인
          </GlassButton>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 0" }}>
          <MoonIcon size={48} style={{ color: "#6366F1", flexShrink: 0 }} />
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            화면 아무 곳이나 터치하면 즉시 60fps로 대시보드로 복귀합니다. Surface Pro 4의 발열과
            번인을 방지하는 미세 픽셀 시프트가 적용됩니다.
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
