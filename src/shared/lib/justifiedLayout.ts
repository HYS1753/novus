/**
 * Justified rows (Google Photos / Flickr style): every row fills the width,
 * every photo keeps its aspect ratio, and rows are about `targetHeight` tall.
 *
 * Items whose aspect is not known yet (their page has not arrived) use an
 * estimate and mark their row provisional; the row is laid out again once
 * the real sizes land.
 */

export interface JustifiedRow {
  top: number;
  height: number;
  /** Item indices [start, end) in the caller's index space. */
  start: number;
  end: number;
  /** Left offset and width of each item in the row. */
  lefts: number[];
  widths: number[];
  provisional: boolean;
}

export interface JustifiedLayout {
  rows: JustifiedRow[];
  height: number;
}

/** A typical library mixes 3:2, 4:3, 16:9 and portraits; this is their rough mean. */
export const ESTIMATED_ASPECT = 1.4;
const MIN_ASPECT = 0.4;
const MAX_ASPECT = 3.2;
/** A short row is never stretched past this much of the target height. */
const MAX_STRETCH = 1.3;

export function layoutJustified(
  aspectAt: (index: number) => number | undefined,
  start: number,
  end: number,
  width: number,
  targetHeight: number,
  gap: number,
  top = 0,
): JustifiedLayout {
  const rows: JustifiedRow[] = [];
  if (width <= 0 || targetHeight <= 0 || end <= start) return { rows, height: 0 };

  let y = top;
  let rowStart = start;
  let aspects: number[] = [];
  let sum = 0;
  let provisional = false;

  const closeRow = (last: boolean) => {
    const gaps = gap * (aspects.length - 1);
    let height = (width - gaps) / sum;
    // The last row keeps the target height (left aligned) unless it already fills.
    if (last && height > targetHeight) height = targetHeight;
    height = Math.min(height, targetHeight * MAX_STRETCH);
    const lefts: number[] = [];
    const widths: number[] = [];
    let x = 0;
    aspects.forEach((aspect, index) => {
      const isLastInFullRow = !last && index === aspects.length - 1;
      // Absorb rounding into the last item so full rows end exactly at the edge.
      const w = isLastInFullRow ? width - x : Math.round(aspect * height);
      lefts.push(x);
      widths.push(w);
      x += w + gap;
    });
    rows.push({
      top: y,
      height: Math.round(height),
      start: rowStart,
      end: rowStart + aspects.length,
      lefts,
      widths,
      provisional,
    });
    y += Math.round(height) + gap;
    rowStart += aspects.length;
    aspects = [];
    sum = 0;
    provisional = false;
  };

  for (let index = start; index < end; index++) {
    const known = aspectAt(index);
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, known ?? ESTIMATED_ASPECT));
    if (known === undefined) provisional = true;
    aspects.push(aspect);
    sum += aspect;
    const rowWidth = sum * targetHeight + gap * (aspects.length - 1);
    if (rowWidth >= width) closeRow(false);
  }
  if (aspects.length > 0) closeRow(true);

  return { rows, height: Math.max(0, y - gap - top) };
}

/** Index of the first row whose bottom is below `y` (binary search). */
export function firstRowBelow(rows: JustifiedRow[], y: number): number {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (rows[mid].top + rows[mid].height < y) low = mid + 1;
    else high = mid;
  }
  return low;
}
