import React, { useState } from "react";
import type { FileItem } from "@/entities";
import { useFileBrowser } from "@/features";
import { GalleryGrid, FullscreenImageViewer, InAppVideoModal } from "@/widgets";
import { SubpageDock, useDockPosition } from "@/shared";

interface GalleryPageProps {
  onBackToDashboard: () => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({ onBackToDashboard }) => {
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
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    navigateTo,
    navigateUp,
    navigateBack,
    refresh,
  } = useFileBrowser({ filterMode: "media" });

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<FileItem | null>(null);

  const imageItems = items.filter((item) => item.media_type === "image");

  return (
    <div
      className={`in-app-player in-app-player--dock-${dockPosition} w-full h-full flex overflow-hidden text-white`}
      style={{ backgroundColor: "var(--color-background, #080a0f)" }}
    >
      {/* Main Viewport Container */}
      <div className="in-app-player__viewport flex-1 flex flex-col h-full overflow-hidden">
        <GalleryGrid
          key={currentPath}
          items={items}
          locations={locations}
          breadcrumbs={breadcrumbs}
          parentPath={parentPath}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortField={sortField}
          onSortFieldChange={setSortField}
          sortOrder={sortOrder}
          onToggleSortOrder={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          onNavigateTo={navigateTo}
          onNavigateUp={navigateUp}
          onSelectImage={(index) => setSelectedImageIndex(index)}
          onSelectVideo={(video) => setSelectedVideo(video)}
        />
      </div>

      {/* Standard Subpage Tablet System Dock */}
      <SubpageDock
        title="미디어 갤러리"
        dockPosition={dockPosition}
        onHome={onBackToDashboard}
        onBack={navigateBack}
        canGoBack={canGoBack}
        onReload={refresh}
      />

      {/* Lightbox / Fullscreen Image Viewer Modal */}
      {selectedImageIndex !== null && (
        <FullscreenImageViewer
          images={imageItems}
          initialIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
        />
      )}

      {/* In-App Video Player Modal */}
      {selectedVideo && (
        <InAppVideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}
    </div>
  );
};
