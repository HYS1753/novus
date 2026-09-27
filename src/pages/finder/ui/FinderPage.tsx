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
    error,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
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
          error={error}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortField={sortField}
          onSortFieldChange={setSortField}
          sortOrder={sortOrder}
          onToggleSortOrder={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          onNavigateTo={navigateTo}
          onNavigateUp={navigateUp}
        />
      </div>

      {/* Standard Subpage Tablet System Dock */}
      <SubpageDock
        title="파일 파인더"
        dockPosition={dockPosition}
        onHome={onBackToDashboard}
        onBack={() => (canGoBack ? navigateBack() : onBackToDashboard())}
        backLabel={canGoBack ? "이전 폴더로 이동" : "대시보드 홈으로 이동"}
        onReload={refresh}
      />
    </div>
  );
};
