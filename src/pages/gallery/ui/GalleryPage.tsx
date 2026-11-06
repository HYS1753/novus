import React, { useMemo, useState } from "react";
import type { FileItem } from "@/entities";
import { PAGE_SIZE, useGallery, type MediaCollection } from "@/features";
import { FullscreenImageViewer, GalleryV2, InAppVideoModal } from "@/widgets";
import { SubpageDock, useDockPosition, useI18n } from "@/shared";

interface GalleryPageProps {
  onBackToDashboard: () => void;
}

type ViewerSource = { which: "library" | "folder"; path: string };

export const GalleryPage: React.FC<GalleryPageProps> = ({ onBackToDashboard }) => {
  const { t } = useI18n();
  const { dockPosition } = useDockPosition();
  const gallery = useGallery();
  const [viewer, setViewer] = useState<ViewerSource | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<FileItem | null>(null);

  const source: MediaCollection | null = viewer
    ? viewer.which === "library"
      ? gallery.library
      : gallery.folderView
    : null;

  // The viewer pages through the images loaded so far, in snapshot order.
  const viewerImages = useMemo(
    () =>
      source ? source.items.filter((item): item is FileItem => item?.media_type === "image") : [],
    // `revision` stands for pages landing in the shared items array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, source?.revision],
  );
  const viewerIndex = viewer
    ? Math.max(
        0,
        viewerImages.findIndex((item) => item.path === viewer.path),
      )
    : 0;
  let lastLoaded = -1;
  if (source) {
    for (let index = source.items.length - 1; index >= 0; index--) {
      if (source.items[index]) {
        lastLoaded = index;
        break;
      }
    }
  }

  const openImage = (collection: MediaCollection, index: number) => {
    const item = collection.items[index];
    if (!item) return;
    setViewer({
      which: collection === gallery.library ? "library" : "folder",
      path: item.path,
    });
  };

  return (
    <div
      className={`in-app-player in-app-player--dock-${dockPosition} w-full h-full flex overflow-hidden`}
    >
      <div className="in-app-player__viewport flex-1 flex flex-col h-full overflow-hidden">
        <GalleryV2 state={gallery} onOpenImage={openImage} onOpenVideo={setSelectedVideo} />
      </div>

      <SubpageDock
        title={t("nav.gallery")}
        dockPosition={dockPosition}
        onHome={onBackToDashboard}
        onBack={() => {
          if (viewer) setViewer(null);
          else if (selectedVideo) setSelectedVideo(null);
          else if (!gallery.folderBack()) onBackToDashboard();
        }}
        backLabel={gallery.canFolderBack ? t("dock.backFolder") : t("dock.home")}
        onReload={gallery.reload}
      />

      {viewer && source && viewerImages.length > 0 && (
        <FullscreenImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          totalImageCount={source.imageCount}
          hasMore={viewerImages.length < source.imageCount}
          isLoadingMore={false}
          loadMoreError={null}
          onNeedMore={() => source.ensureRange(lastLoaded + 1, lastLoaded + 1 + PAGE_SIZE)}
          onClose={() => setViewer(null)}
        />
      )}

      {selectedVideo && (
        <InAppVideoModal
          key={selectedVideo.path}
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
};
