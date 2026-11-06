import React, { useEffect, useLayoutEffect, useState } from "react";
import type { GalleryState, MediaCollection } from "@/features";
import {
  ChevronRightIcon,
  FolderIcon,
  ImageIcon,
  NvButton,
  NvEmptyState,
  VideoIcon,
  useI18n,
  type FileItem,
} from "@/shared";
import { GalleryHeader } from "./GalleryHeader";
import { JustifiedGrid } from "./JustifiedGrid";
import "./gallery-v2.css";

export interface GalleryV2Props {
  state: GalleryState;
  /** An image was pressed: its collection and snapshot index. */
  onOpenImage: (collection: MediaCollection, index: number) => void;
  onOpenVideo: (item: FileItem) => void;
}

/** Row height and gap come from CSS (`--gv-row`, `--gv-gap`), so posture and scale apply. */
function useGridMetrics(probe: HTMLElement | null) {
  const [metrics, setMetrics] = useState({ row: 180, gap: 4 });
  useLayoutEffect(() => {
    if (!probe) return;
    const read = () => setMetrics({ row: probe.offsetHeight || 180, gap: probe.offsetWidth || 4 });
    const observer = new ResizeObserver(read);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [probe]);
  return metrics;
}

const Skeleton: React.FC = () => (
  <div className="gv-skeleton" aria-hidden="true">
    {Array.from({ length: 12 }, (_, index) => (
      <span key={index} style={{ flexGrow: [3, 2, 4, 3, 2, 3, 4, 2, 3, 3, 2, 4][index] }} />
    ))}
  </div>
);

/**
 * The gallery (tablet posture): the location as the title, three views
 * (photos across every subfolder, folders, videos), one scroller.
 */
export const GalleryV2: React.FC<GalleryV2Props> = ({ state, onOpenImage, onOpenVideo }) => {
  const { t } = useI18n();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [probe, setProbe] = useState<HTMLSpanElement | null>(null);
  const metrics = useGridMetrics(probe);
  const collection = state.tab === "folders" ? state.folderView : state.library;

  const open = (target: MediaCollection) => (index: number) => {
    const item = target.items[index];
    if (!item) return;
    if (item.is_dir) state.openFolder(item.path);
    else if (item.media_type === "video") onOpenVideo(item);
    else onOpenImage(target, index);
  };

  // Folders come first in a folder snapshot; they render as cards, media as the grid.
  let folderCount = 0;
  if (state.tab === "folders") {
    while (folderCount < collection.total && collection.items[folderCount]?.is_dir) folderCount++;
  }

  // More subfolders than one page: fetch on until the folders end.
  const folderGap =
    state.tab === "folders" && folderCount < collection.total && !collection.items[folderCount];
  const { ensureRange } = collection;
  useEffect(() => {
    if (folderGap) ensureRange(folderCount, folderCount + 1);
  }, [ensureRange, folderCount, folderGap]);

  const empty = collection.status === "ready" && collection.total === 0;
  const searchMiss = empty && state.search.trim().length > 0;

  return (
    <section className="gv" aria-label={t("nav.gallery")}>
      <GalleryHeader state={state} />
      <span ref={setProbe} className="gv__probe" aria-hidden="true" />

      <div ref={setScroller} className="gv__body" data-nav-scope>
        {state.tab === "folders" && state.crumbs.length > 1 && (
          <nav className="gv-crumbs" aria-label={t("files.location")}>
            {state.crumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && (
                  <span className="gv-crumbs__sep" aria-hidden="true">
                    <ChevronRightIcon size={14} />
                  </span>
                )}
                <button
                  type="button"
                  className="gv-crumbs__item"
                  aria-current={index === state.crumbs.length - 1 ? "page" : undefined}
                  onClick={() => state.openFolder(crumb.path)}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {collection.status === "loading" && <Skeleton />}

        {collection.status === "error" && (
          <NvEmptyState
            icon={<FolderIcon size={28} />}
            title={t("files.loadError")}
            body={t("files.loadErrorHint")}
            action={<NvButton onClick={state.reload}>{t("common.retry")}</NvButton>}
          />
        )}

        {empty && (
          <NvEmptyState
            icon={state.tab === "videos" ? <VideoIcon size={28} /> : <ImageIcon size={28} />}
            title={
              searchMiss
                ? t("gallery.noResults", { query: state.search.trim() })
                : t("gallery.emptyLibrary")
            }
            body={searchMiss ? undefined : t("gallery.emptyLibraryHint")}
            action={
              searchMiss ? (
                <NvButton onClick={() => state.setSearch("")}>{t("gallery.clearSearch")}</NvButton>
              ) : undefined
            }
          />
        )}

        {collection.status === "ready" && folderCount > 0 && (
          <div className="gv-folders">
            {collection.items.slice(0, folderCount).map(
              (item, index) =>
                item && (
                  <button
                    key={item.path}
                    type="button"
                    className="gv-folder"
                    onClick={() => open(collection)(index)}
                  >
                    <span className="gv-folder__icon" aria-hidden="true">
                      <FolderIcon size={22} />
                    </span>
                    <span className="gv-folder__name">{item.name}</span>
                  </button>
                ),
            )}
          </div>
        )}

        {collection.status === "ready" && collection.total > folderCount && (
          <>
            {folderCount > 0 && <h3 className="gv-section">{t("gallery.mediaHeading")}</h3>}
            <JustifiedGrid
              items={collection.items}
              start={folderCount}
              end={collection.total}
              revision={collection.revision}
              ensureRange={collection.ensureRange}
              scroller={scroller}
              rowHeight={metrics.row}
              gap={metrics.gap}
              onOpen={open(collection)}
            />
          </>
        )}
      </div>
    </section>
  );
};
