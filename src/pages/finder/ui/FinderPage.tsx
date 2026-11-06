import React, { useEffect, useMemo, useState } from "react";
import type { FileItem } from "@/entities";
import { useFileBrowser } from "@/features";
import { FilesV2, InAppVideoModal, PhotoViewer } from "@/widgets";
import { NvToast, SubpageDock, openFileInOs, useDockPosition, useI18n } from "@/shared";

interface FinderPageProps {
  onBackToDashboard: () => void;
  /** Folder to open instead of the last visited one. */
  initialPath?: string;
}

/** A notice stays this long, then leaves on its own. */
const TOAST_MS = 4000;

/**
 * Files: folders and files of every kind. Photos open in the Novus photo
 * viewer (paging through the folder's photos), videos in the Novus player,
 * everything else in the app the OS assigns.
 */
export const FinderPage: React.FC<FinderPageProps> = ({ onBackToDashboard, initialPath }) => {
  const { t } = useI18n();
  const { dockPosition } = useDockPosition();
  const browser = useFileBrowser({ filterMode: "all", initialPath });
  const [viewerPath, setViewerPath] = useState<string | null>(null);
  const [video, setVideo] = useState<FileItem | null>(null);
  const [toast, setToast] = useState<{ message: string; attention: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const images = useMemo(
    () => browser.items.filter((item) => item.media_type === "image"),
    [browser.items],
  );
  const viewerIndex = viewerPath ? images.findIndex((item) => item.path === viewerPath) : -1;

  const openFile = async (item: FileItem) => {
    if (item.media_type === "image") return setViewerPath(item.path);
    if (item.media_type === "video") return setVideo(item);
    try {
      await openFileInOs(item.path);
      setToast({ message: t("finder.opened", { name: item.name }), attention: false });
    } catch (error) {
      // The reason is for the log; the notice stays in plain words.
      console.warn("Open in OS failed", error);
      setToast({ message: t("finder.openFailedPlain", { name: item.name }), attention: true });
    }
  };

  return (
    <div
      className={`in-app-player in-app-player--dock-${dockPosition} w-full h-full flex overflow-hidden`}
    >
      <div className="in-app-player__viewport flex-1 flex flex-col h-full overflow-hidden">
        <FilesV2
          key={browser.currentPath}
          locations={browser.locations}
          currentPath={browser.currentPath}
          parentPath={browser.parentPath}
          breadcrumbs={browser.breadcrumbs}
          items={browser.items}
          isLoading={browser.isLoading}
          error={browser.error}
          searchQuery={browser.searchQuery}
          onSearchChange={browser.setSearchQuery}
          sortField={browser.sortField}
          sortOrder={browser.sortOrder}
          onSortChange={(field, order) => {
            browser.setSortField(field);
            browser.setSortOrder(order);
          }}
          onNavigateTo={browser.navigateTo}
          onNavigateUp={browser.navigateUp}
          onReload={browser.refresh}
          onOpenFile={(item) => void openFile(item)}
        />
        {toast && (
          <NvToast
            className="fs-toast"
            message={toast.message}
            tone={toast.attention ? "attention" : "neutral"}
          />
        )}
      </div>

      <SubpageDock
        title={t("nav.files")}
        dockPosition={dockPosition}
        onHome={onBackToDashboard}
        onBack={() => {
          if (viewerPath) setViewerPath(null);
          else if (video) setVideo(null);
          else if (browser.canGoBack) browser.navigateBack();
          else onBackToDashboard();
        }}
        backLabel={browser.canGoBack ? t("dock.backFolder") : t("dock.home")}
        onReload={browser.refresh}
      />

      {viewerPath && viewerIndex >= 0 && (
        <PhotoViewer
          images={images}
          initialIndex={viewerIndex}
          totalImageCount={images.length}
          displayTotal={images.length}
          hasMore={false}
          onNeedMore={() => undefined}
          onClose={() => setViewerPath(null)}
        />
      )}

      {video && <InAppVideoModal key={video.path} video={video} onClose={() => setVideo(null)} />}
    </div>
  );
};
