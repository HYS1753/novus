import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  firstRowBelow,
  layoutJustified,
  useI18n,
  type FileItem,
  type JustifiedRow,
} from "@/shared";
import { MediaThumb } from "./MediaThumb";

/** A run of items shown under one heading (a month on the timeline). */
export interface GridSection {
  key: string;
  start: number;
  end: number;
  /** Heading text; sections without one are laid out with no heading. */
  label?: string;
  /** Secondary heading text, e.g. the item count. */
  meta?: string;
  /** Year, for the scrubber's year marks. */
  year?: number;
}

/** Where each section sits once laid out, for the scrubber. */
export interface PlacedSection {
  key: string;
  top: number;
  label?: string;
  year?: number;
}

export interface GridPlacement {
  sections: PlacedSection[];
  height: number;
  /** The grid's top inside the scrolled content. */
  offset: number;
}

export interface JustifiedGridProps {
  /** The collection's sparse items (snapshot index space). */
  items: (FileItem | undefined)[];
  sections: GridSection[];
  /** Bumps when pages land. */
  revision: number;
  ensureRange: (start: number, end: number) => void;
  /** The element that scrolls (the gallery body). */
  scroller: HTMLElement | null;
  rowHeight: number;
  gap: number;
  headerHeight: number;
  onOpen: (index: number) => void;
  onPlacement?: (placement: GridPlacement) => void;
}

/** Rows rendered beyond the viewport, above and below, as a share of its height. */
const OVERSCAN = 0.5;
/** Items prefetched past the last visible one. */
const PREFETCH_ITEMS = 120;

function aspectOf(item: FileItem | undefined): number | undefined {
  if (!item) return undefined;
  if (item.media_type === "video") return 16 / 9;
  if (item.width && item.height) return item.width / item.height;
  return 4 / 3;
}

interface Heading {
  key: string;
  top: number;
  label: string;
  meta?: string;
}

/** The grid's top inside the scrolled content. */
function offsetIn(scroller: HTMLElement, grid: HTMLElement) {
  return (
    grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  );
}

/**
 * Justified photo grid under section headings, virtualized: only rows near
 * the viewport exist in the DOM, and the pages under them are requested as
 * they come into view. When estimated rows above the viewport are replaced
 * by real sizes, the scroll position follows the first visible photo, so
 * nothing jumps under the reader.
 */
export const JustifiedGrid: React.FC<JustifiedGridProps> = ({
  items,
  sections,
  revision,
  ensureRange,
  scroller,
  rowHeight,
  gap,
  headerHeight,
  onOpen,
  onPlacement,
}) => {
  const { t } = useI18n();
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  // The mounted window as row indices: it changes only when a row enters or
  // leaves it, not on every scrolled pixel.
  const [range, setRange] = useState({ first: 0, last: 0 });
  const anchorRef = useRef<{ index: number; top: number } | null>(null);
  // Scroll writes go through a ref: the element itself is a prop.
  const scrollerRef = useRef(scroller);
  useEffect(() => {
    scrollerRef.current = scroller;
  }, [scroller]);

  useLayoutEffect(() => {
    if (!grid) return;
    // Fires once on observe, then on every width change.
    const observer = new ResizeObserver(() => setWidth(grid.clientWidth));
    observer.observe(grid);
    return () => observer.disconnect();
  }, [grid]);

  const layout = useMemo(() => {
    const rows: JustifiedRow[] = [];
    const headings: Heading[] = [];
    const placed: PlacedSection[] = [];
    let y = 0;
    sections.forEach((section, index) => {
      if (index > 0) y += gap * 6;
      placed.push({ key: section.key, top: y, label: section.label, year: section.year });
      if (section.label) {
        headings.push({ key: section.key, top: y, label: section.label, meta: section.meta });
        y += headerHeight;
      }
      const part = layoutJustified(
        (item) => aspectOf(items[item]),
        section.start,
        section.end,
        width,
        rowHeight,
        gap,
        y,
      );
      rows.push(...part.rows);
      y += part.height;
    });
    return { rows, headings, placed, height: y };
    // `revision` stands for the in-place mutation of `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, revision, sections, width, rowHeight, gap, headerHeight]);

  // Track the viewport and remember the first visible photo as the anchor.
  // The grid's offset in the scroller is read on resize and re-layout only.
  const rowsRef = useRef(layout.rows);
  const offsetRef = useRef(0);
  const readRef = useRef<(remeasure: boolean) => void>(() => undefined);
  useLayoutEffect(() => {
    if (!scroller || !grid) return;
    let frame = 0;
    let remeasure = true;
    const read = () => {
      frame = 0;
      if (remeasure) {
        offsetRef.current = offsetIn(scroller, grid);
        remeasure = false;
      }
      const top = scroller.scrollTop - offsetRef.current;
      const height = scroller.clientHeight;
      const rows = rowsRef.current;
      const anchor = rows[firstRowBelow(rows, top)];
      anchorRef.current = anchor ? { index: anchor.start, top: anchor.top } : null;
      const over = height * OVERSCAN;
      const first = firstRowBelow(rows, top - over);
      let last = first;
      while (last < rows.length && rows[last].top < top + height + over) last++;
      setRange((current) =>
        current.first === first && current.last === last ? current : { first, last },
      );
    };
    const schedule = (measure: boolean) => {
      remeasure ||= measure;
      if (!frame) frame = requestAnimationFrame(read);
    };
    readRef.current = schedule;
    const onScroll = () => schedule(false);
    const onResize = () => schedule(true);
    schedule(true);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onResize);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [grid, scroller]);
  useLayoutEffect(() => {
    rowsRef.current = layout.rows;
    readRef.current(true);
  }, [layout.rows]);

  // Re-layout: keep the anchor photo where the reader left it.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const target = scrollerRef.current;
    if (!anchor || !target) return;
    const row = layout.rows.find(
      (entry) => anchor.index >= entry.start && anchor.index < entry.end,
    );
    if (!row || row.top === anchor.top) return;
    target.scrollTop += row.top - anchor.top;
    anchorRef.current = { index: anchor.index, top: row.top };
  }, [layout]);

  useEffect(() => {
    if (!scroller || !grid) return;
    onPlacement?.({
      sections: layout.placed,
      height: layout.height,
      offset: offsetIn(scroller, grid),
    });
  }, [grid, layout.placed, layout.height, onPlacement, scroller]);

  const visible = layout.rows.slice(range.first, range.last);
  const visibleStart = visible[0]?.start ?? 0;
  const visibleEnd = visible.at(-1)?.end ?? 0;
  // A heading shows with the rows around it (it sits just above its first row).
  const spanTop = (visible[0]?.top ?? 0) - headerHeight - gap * 6;
  const spanBottom = visible.length
    ? visible[visible.length - 1].top + visible[visible.length - 1].height
    : 0;
  const headings = layout.headings.filter(
    (heading) => heading.top >= spanTop && heading.top <= spanBottom,
  );

  useEffect(() => {
    if (visibleEnd > visibleStart) ensureRange(visibleStart, visibleEnd + PREFETCH_ITEMS);
  }, [ensureRange, visibleEnd, visibleStart]);

  return (
    <div ref={setGrid} className="gv-grid" style={{ height: layout.height }}>
      {headings.map((heading) => (
        <h3
          key={heading.key}
          className="gv-grid__heading"
          style={{ transform: `translate3d(0, ${heading.top}px, 0)`, height: headerHeight }}
        >
          <span>{heading.label}</span>
          {heading.meta && <span className="gv-grid__meta">{heading.meta}</span>}
        </h3>
      ))}
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
