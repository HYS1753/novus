import React, { useEffect, useMemo } from "react";
import {
  useFolderSummaries,
  type GalleryState,
  type GalleryTab,
  type MediaCollection,
} from "@/features";
import { ChevronRightIcon, FolderIcon, useI18n, type FileItem } from "@/shared";
import { MediaThumb } from "./MediaThumb";

/** Tiles per shelf: a screen and a half of lean-back browsing. */
const SHELF_LIMIT = 18;

function shelfItems(collection: MediaCollection, filter: (item: FileItem) => boolean) {
  const result: { item: FileItem; index: number }[] = [];
  for (let index = 0; index < collection.items.length && result.length < SHELF_LIMIT; index++) {
    const item = collection.items[index];
    if (item && filter(item)) result.push({ item, index });
  }
  return result;
}

function aspectOf(item: FileItem): number {
  if (item.media_type === "video") return 16 / 9;
  if (item.width && item.height) return Math.min(1.8, Math.max(0.75, item.width / item.height));
  return 4 / 3;
}

const Shelf: React.FC<{
  title: string;
  seeAllLabel: string;
  onSeeAll: () => void;
  children: React.ReactNode;
}> = ({ title, seeAllLabel, onSeeAll, children }) => (
  <section className="gv-shelf">
    <div className="gv-shelf__head">
      <h3 className="gv-shelf__title">{title}</h3>
      <button type="button" className="gv-shelf__all" onClick={onSeeAll}>
        {seeAllLabel}
        <ChevronRightIcon size={18} />
      </button>
    </div>
    {/* Sideways rows own left/right only through spatial navigation (focus scrolls them). */}
    <div className="gv-shelf__row">{children}</div>
  </section>
);

export interface GalleryShelvesProps {
  state: GalleryState;
  rowHeight: number;
  onOpenImage: (collection: MediaCollection, index: number) => void;
  onOpenVideo: (item: FileItem) => void;
}

/**
 * The gallery in TV posture (Apple TV / Google TV photos): rows to lean
 * back on — recent photos, videos, folders — moved through with the arrow
 * keys, each with "see all" into the full timeline or folder view.
 */
export const GalleryShelves: React.FC<GalleryShelvesProps> = ({
  state,
  rowHeight,
  onOpenImage,
  onOpenVideo,
}) => {
  const { t } = useI18n();
  const { library, videoShelf, folderShelf } = state;

  const photos = useMemo(
    () => shelfItems(library, (item) => item.media_type === "image"),
    // `revision` stands for pages landing in the shared items array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library.items, library.revision],
  );
  const videos = useMemo(
    () => shelfItems(videoShelf, (item) => item.media_type === "video"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [videoShelf.items, videoShelf.revision],
  );
  const folders = useMemo(
    () => shelfItems(folderShelf, (item) => item.is_dir),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folderShelf.items, folderShelf.revision],
  );
  const summaries = useFolderSummaries(folders.map(({ item }) => item.path));

  // The first shelf takes focus, so the remote starts somewhere useful.
  const ready = photos.length > 0;
  useEffect(() => {
    if (!ready) return;
    const active = document.activeElement;
    if (!active || active === document.body) {
      document.querySelector<HTMLElement>(".gv-shelf__tile")?.focus({ preventScroll: true });
    }
  }, [ready]);

  const seeAll = (tab: GalleryTab) => () => state.setTab(tab);
  const tileStyle = (item: FileItem) => ({
    width: Math.round(rowHeight * aspectOf(item)),
    height: rowHeight,
  });

  return (
    <div className="gv-shelves">
      {photos.length > 0 && (
        <Shelf
          title={t("gallery.recentPhotos")}
          seeAllLabel={t("gallery.seeAll")}
          onSeeAll={seeAll("photos")}
        >
          {photos.map(({ item, index }, position) => (
            <button
              key={item.path}
              type="button"
              className="gv-shelf__tile"
              style={tileStyle(item)}
              aria-label={item.name}
              data-nav-default={position === 0 || undefined}
              onClick={() => onOpenImage(library, index)}
            >
              <MediaThumb item={item} size={rowHeight * aspectOf(item)} />
            </button>
          ))}
        </Shelf>
      )}

      {videos.length > 0 && (
        <Shelf
          title={t("gallery.tabVideos")}
          seeAllLabel={t("gallery.seeAll")}
          onSeeAll={seeAll("videos")}
        >
          {videos.map(({ item }) => (
            <button
              key={item.path}
              type="button"
              className="gv-shelf__tile"
              style={tileStyle(item)}
              aria-label={`${t("gallery.tabVideos")} · ${item.name}`}
              onClick={() => onOpenVideo(item)}
            >
              <MediaThumb item={item} size={rowHeight * 1.78} />
              <span className="gv-shelf__caption">{item.name}</span>
            </button>
          ))}
        </Shelf>
      )}

      {folders.length > 0 && (
        <Shelf
          title={t("gallery.tabFolders")}
          seeAllLabel={t("gallery.seeAll")}
          onSeeAll={seeAll("folders")}
        >
          {folders.map(({ item }) => {
            const summary = summaries.get(item.path);
            return (
              <button
                key={item.path}
                type="button"
                className="gv-shelf__tile gv-shelf__tile--folder"
                style={{ width: Math.round(rowHeight * (4 / 3)), height: rowHeight }}
                aria-label={item.name}
                onClick={() => {
                  state.setTab("folders");
                  state.openFolder(item.path);
                }}
              >
                {summary?.cover ? (
                  <MediaThumb item={summary.cover} size={rowHeight * 1.34} />
                ) : (
                  <span className="gv-album__glyph" aria-hidden="true">
                    <FolderIcon size={36} />
                  </span>
                )}
                <span className="gv-shelf__caption">
                  {item.name}
                  {summary && summary.media_count > 0 && (
                    <span className="gv-shelf__count">
                      {t("gallery.folderItems", { count: summary.media_count })}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </Shelf>
      )}
    </div>
  );
};
