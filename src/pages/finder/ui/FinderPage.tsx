import React from "react";
import { useFileBrowser } from "@/features";
import { SystemFinder } from "@/widgets";
import { SubpageDock, useDockPosition } from "@/shared";

interface FinderPageProps {
  onBackToDashboard: () => void;
}

export const FinderPage: React.FC<FinderPageProps> = ({ onBackToDashboard }) => {
  const { dockPosition } = useDockPosition();
  const {
    locations,
    currentPath,
    parentPath,
    breadcrumbs,
    canGoBack,
    items,
    isLoading,
    searchQuery,
    setSearchQuery,
    navigateTo,
    navigateUp,
    navigateBack,
    refresh,
  } = useFileBrowser({ filterMode: "all" });

  return (
    <div
      className={`in-app-player in-app-player--dock-${dockPosition} w-full h-full flex overflow-hidden text-white`}
      style={{ backgroundColor: "var(--color-background, #080a0f)" }}
    >
      {/* Main Viewport */}
      <div className="in-app-player__viewport flex-1 flex flex-col h-full overflow-hidden">
        <SystemFinder
          key={currentPath}
          locations={locations}
          currentPath={currentPath}
          parentPath={parentPath}
          breadcrumbs={breadcrumbs}
          items={items}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigateTo={navigateTo}
          onNavigateUp={navigateUp}
        />
      </div>

      {/* Standard Subpage Tablet System Dock */}
      <SubpageDock
        title="파일 파인더"
        dockPosition={dockPosition}
        onHome={onBackToDashboard}
        onBack={navigateBack}
        canGoBack={canGoBack}
        onReload={refresh}
      />
    </div>
  );
};
