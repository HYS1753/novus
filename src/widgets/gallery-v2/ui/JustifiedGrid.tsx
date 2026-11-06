import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { firstRowBelow, layoutJustified, useI18n, type FileItem } from "@/shared";
import { MediaThumb } from "./MediaThumb";

export interface JustifiedGridProps {
  /** The collection's sparse items (snapshot index space). */
  items: (FileItem | undefined)[];
  /** First and one-past-last index this grid shows. */
  start: number;
  end: number;
  /** Bumps when pages land. */
  revision: number;
  ensureRange: (start: number, end: number) => void;
  /** The element that scrolls (the gallery body). */
  scroller: HTMLElement | null;
  rowHeight: number;
  gap: number;
  onOpen: (index: number) => void;
}

/** Rows rendered beyond the viewport, above and below. */
const OVERSCAN_PX = 600;
/** Items prefetched past the last visible one. */
const PREFETCH_ITEMS = 120;

function aspectOf(item: FileItem | undefined): number | undefined {
  if (!item) return undefined;
  if (item.media_type === "video") return 16 / 9;
  if (item.width && item.height) return item.width / item.height;
  return 4 / 3;
}

function useViewport(scroller: HTMLElement | null, grid: HTMLElement | null) {
  const [view, setView] = useState({ top: 0, height: 0 });
  useLayoutEffect(() => {
    if (!scroller || !grid) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      // The grid's position inside the scrolled content.
      const offset =
        grid.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      setView({ top: scroller.scrollTop - offset, height: scroller.clientHeight });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [grid, scroller]);
  return view;
}

/**
 * Justified photo grid, virtualized: only rows near the viewport exist in
 * the DOM, and the pages under them are requested as they come into view.
 */
export const JustifiedGrid: React.FC<JustifiedGridProps> = ({
  items,
  start,
  end,
  revision,
  ensureRange,
  scroller,
  rowHeight,
  gap,
  onOpen,
}) => {
  const { t } = useI18n();
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!grid) return;
    // Fires once on observe, then on every width change.
    const observer = new ResizeObserver(() => setWidth(grid.clientWidth));
    observer.observe(grid);
    return () => observer.disconnect();
  }, [grid]);

  const layout = useMemo(
    () => layoutJustified((index) => aspectOf(items[index]), start, end, width, rowHeight, gap),
    // `revision` stands for the in-place mutation of `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, revision, start, end, width, rowHeight, gap],
  );

  const view = useViewport(scroller, grid);
  const first = firstRowBelow(layout.rows, view.top - OVERSCAN_PX);
  let last = first;
  while (last < layout.rows.length && layout.rows[last].top < view.top + view.height + OVERSCAN_PX)
    last++;
  const visible = layout.rows.slice(first, last);
  const visibleStart = visible[0]?.start ?? start;
  const visibleEnd = visible.at(-1)?.end ?? start;

  useEffect(() => {
    if (visibleEnd > visibleStart) ensureRange(visibleStart, visibleEnd + PREFETCH_ITEMS);
  }, [ensureRange, visibleEnd, visibleStart]);

  return (
    <div ref={setGrid} className="gv-grid" style={{ height: layout.height }}>
      {visible.map((row) =>
        row.widths.map((tileWidth, column) => {
          const index = row.start + column;
          const item = items[index];
          const label = item
            ? item.media_type === "video"
              ? `${t("gallery.tabVideos")} · ${item.name}`
              : item.name
            : t("gallery.loading");
          return (
            <button
              key={item?.path ?? `pending-${index}`}
              type="button"
              className="gv-tile"
              style={{
                transform: `translate3d(${row.lefts[column]}px, ${row.top}px, 0)`,
                width: tileWidth,
                height: row.height,
              }}
              disabled={!item}
              aria-label={label}
              onClick={() => onOpen(index)}
            >
              <MediaThumb item={item} size={Math.max(tileWidth, row.height)} />
            </button>
          );
        }),
      )}
    </div>
  );
};
