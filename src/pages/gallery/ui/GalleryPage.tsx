import React, { useMemo, useState } from "react";
import type { FileItem } from "@/entities";
import { PAGE_SIZE, useGallery, type MediaCollection } from "@/features";
import { GalleryV2, InAppVideoModal, PhotoViewer } from "@/widgets";
import { SubpageDock, useDockPosition, useI18n } from "@/shared";

interface GalleryPageProps {
  onBackToDashboard: () => void;
}

/**
 * The viewer pages through one contiguous loaded run of the collection,
 * starting where the run began when it opened (so the list only grows at
 * its end and indices stay stable). After a scrubber jump the run starts at
 * that page, not at the top of the library.
 */
type ViewerSource = { which: "library" | "folder"; path: string; runStart: number };

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

  const runStart = viewer?.runStart ?? 0;
  let runEnd = runStart;
  if (source) while (runEnd < source.items.length && source.items[runEnd]) runEnd++;
  const viewerImages = useMemo(
    () =>
      source
        ? source.items
            .slice(runStart, runEnd)
            .filter((item): item is FileItem => item?.media_type === "image")
        : [],
    // `revision` stands for pages landing in the shared items array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, source?.revision, runStart, runEnd],
  );
  const viewerIndex = viewer
    ? Math.max(
        0,
        viewerImages.findIndex((item) => item.path === viewer.path),
      )
    : 0;
  const imagesAfterRun = source
    ? source.items.slice(runEnd).some((item) => item === undefined || item.media_type === "image")
    : false;

  const openImage = (collection: MediaCollection, index: number) => {
    const item = collection.items[index];
    if (!item) return;
    let start = index;
    while (start > 0 && collection.items[start - 1]) start--;
    setViewer({
      which: collection === gallery.library ? "library" : "folder",
      path: item.path,
      runStart: start,
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
        <PhotoViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          totalImageCount={imagesAfterRun ? viewerImages.length + 1 : viewerImages.length}
          hasMore={imagesAfterRun}
          displayTotal={runStart === 0 ? source.imageCount : undefined}
          onNeedMore={() => source.ensureRange(runEnd, runEnd + PAGE_SIZE)}
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
