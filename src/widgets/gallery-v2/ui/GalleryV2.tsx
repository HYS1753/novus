import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFolderSummaries, type GalleryState, type MediaCollection } from "@/features";
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
import { MediaThumb } from "./MediaThumb";
import { DateScrubber } from "./DateScrubber";
import { JustifiedGrid, type GridPlacement, type GridSection } from "./JustifiedGrid";
import "./gallery-v2.css";

export interface GalleryV2Props {
  state: GalleryState;
  /** An image was pressed: its collection and snapshot index. */
  onOpenImage: (collection: MediaCollection, index: number) => void;
  onOpenVideo: (item: FileItem) => void;
}

/**
 * Row height, gap, and heading height come from CSS (`--gv-row`, `--gv-gap`,
 * `--gv-heading`), so posture, scale, and density all apply.
 */
function useGridMetrics(probe: HTMLElement | null) {
  const [metrics, setMetrics] = useState({ row: 180, gap: 4, heading: 56 });
  useLayoutEffect(() => {
    if (!probe) return;
    const heading = probe.firstElementChild as HTMLElement | null;
    const read = () =>
      setMetrics({
        row: probe.offsetHeight || 180,
        gap: probe.offsetWidth || 4,
        heading: heading?.offsetHeight || 56,
      });
    const observer = new ResizeObserver(read);
    observer.observe(probe);
    if (heading) observer.observe(heading);
    return () => observer.disconnect();
  }, [probe]);
  return metrics;
}

/** Three densities, as pinching in Google Photos steps between them. */
const DENSITY = [0.66, 1, 1.5] as const;
const DENSITY_KEY = "novus.gallery.v2.density";

function readDensity(): number {
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    const value = stored === null ? NaN : Number(stored);
    return Number.isInteger(value) && value >= 0 && value < DENSITY.length ? value : 1;
  } catch {
    return 1;
  }
}

/** Pinch (two fingers) or ctrl+wheel (trackpad pinch) steps the density. */
function usePinchDensity(target: HTMLElement | null) {
  const [density, setDensity] = useState(readDensity);
  const step = useCallback((direction: 1 | -1) => {
    setDensity((current) => {
      const next = Math.min(DENSITY.length - 1, Math.max(0, current + direction));
      try {
        localStorage.setItem(DENSITY_KEY, String(next));
      } catch {
        // Density still changes for this visit.
      }
      return next;
    });
  }, []);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const startDistance = useRef(0);

  useEffect(() => {
    if (!target) return;
    let wheel = 0;
    let wheelTimer = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      wheel += event.deltaY;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (wheel = 0), 240);
      if (Math.abs(wheel) > 60) {
        step(wheel < 0 ? 1 : -1);
        wheel = 0;
      }
    };
    const distance = () => {
      const [a, b] = [...pointers.current.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) startDistance.current = distance();
    };
    const onMove = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2 && startDistance.current > 0) {
        const ratio = distance() / startDistance.current;
        if (ratio > 1.3 || ratio < 0.77) {
          step(ratio > 1 ? 1 : -1);
          startDistance.current = distance();
        }
      }
    };
    const onUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) startDistance.current = 0;
    };
    target.addEventListener("wheel", onWheel, { passive: false });
    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
    return () => {
      target.removeEventListener("wheel", onWheel);
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      window.clearTimeout(wheelTimer);
    };
  }, [step, target]);

  return density;
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
  const { t, locale } = useI18n();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [probe, setProbe] = useState<HTMLSpanElement | null>(null);
  const metrics = useGridMetrics(probe);
  const density = usePinchDensity(scroller);
  const [placement, setPlacement] = useState<GridPlacement>({ sections: [], height: 0, offset: 0 });
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

  // Folder cards: the loaded subfolders, each with a cover and count.
  const folders = useMemo(
    () =>
      collection.items
        .slice(0, folderCount)
        .filter((item): item is FileItem => Boolean(item?.is_dir)),
    // `revision` stands for pages landing in the shared items array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection.items, collection.revision, folderCount],
  );
  const summaries = useFolderSummaries(folders.map((item) => item.path));
  const fmt = new Intl.NumberFormat(locale);

  // The timeline groups by month when sorted by date; other sorts read as one run.
  const byDate = state.tab !== "folders" && state.sort.field === "modified";
  const { buckets, total } = collection;
  const sections = useMemo<GridSection[]>(() => {
    if (byDate && buckets.length > 0) {
      const month = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
      const count = new Intl.NumberFormat(locale);
      return buckets.map((bucket) => ({
        key: `${bucket.year}-${bucket.month}-${bucket.first_index}`,
        start: bucket.first_index,
        end: bucket.first_index + bucket.count,
        label: month.format(new Date(bucket.year, bucket.month - 1, 1)),
        meta: count.format(bucket.count),
        year: bucket.year,
      }));
    }
    return [{ key: "all", start: folderCount, end: total }];
  }, [buckets, byDate, folderCount, locale, total]);

  const empty = collection.status === "ready" && collection.total === 0;
  const searchMiss = empty && state.search.trim().length > 0;

  return (
    <section
      className="gv"
      aria-label={t("nav.gallery")}
      style={{ ["--gv-density" as string]: DENSITY[density] }}
    >
      <GalleryHeader state={state} />
      <span ref={setProbe} className="gv__probe" aria-hidden="true">
        <span className="gv__probe-heading" />
      </span>

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
          <div className="gv-albums">
            {folders.map((item) => {
              const summary = summaries.get(item.path);
              const meta = summary
                ? [
                    summary.media_count > 0
                      ? t("gallery.folderItems", { count: fmt.format(summary.media_count) })
                      : t("gallery.folderNoMedia"),
                    summary.has_subfolders ? t("gallery.folderHasSub") : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "\u00a0";
              return (
                <button
                  key={item.path}
                  type="button"
                  className="gv-album"
                  onClick={() => state.openFolder(item.path)}
                >
                  <span className="gv-album__cover">
                    {summary?.cover ? (
                      <MediaThumb item={summary.cover} size={metrics.row * 1.4} />
                    ) : (
                      <span className="gv-album__glyph" aria-hidden="true">
                        <FolderIcon size={28} />
                      </span>
                    )}
                  </span>
                  <span className="gv-album__name">{item.name}</span>
                  <span className="gv-album__meta">{meta}</span>
                </button>
              );
            })}
          </div>
        )}

        {collection.status === "ready" && collection.total > folderCount && (
          <>
            {folderCount > 0 && <h3 className="gv-section">{t("gallery.mediaHeading")}</h3>}
            <JustifiedGrid
              items={collection.items}
              sections={sections}
              revision={collection.revision}
              ensureRange={collection.ensureRange}
              scroller={scroller}
              rowHeight={metrics.row}
              gap={metrics.gap}
              headerHeight={metrics.heading}
              onOpen={open(collection)}
              onPlacement={setPlacement}
            />
          </>
        )}
      </div>

      {collection.status === "ready" && state.tab !== "folders" && (
        <DateScrubber scroller={scroller} placement={placement} />
      )}
    </section>
  );
};
