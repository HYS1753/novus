import React, { useCallback, useEffect, useRef, useState } from "react";
import type { GridPlacement, PlacedSection } from "./JustifiedGrid";

export interface DateScrubberProps {
  scroller: HTMLElement | null;
  placement: GridPlacement;
}

/** Shown while scrolling, then fades after this long without movement. */
const IDLE_MS = 1400;
/** Year marks closer than this (px) to the previous one are skipped. */
const MIN_MARK_GAP = 22;

function sectionAt(sections: PlacedSection[], y: number): PlacedSection | undefined {
  let found: PlacedSection | undefined;
  for (const section of sections) {
    if (section.top > y) break;
    found = section;
  }
  return found ?? sections[0];
}

/**
 * The timeline's fast lane (Google Photos style): a thin handle on the
 * right edge that appears while scrolling. Dragging it — or pressing
 * anywhere on the track — moves through the library, with a bubble naming
 * the month under it and the years marked along the track.
 */
export const DateScrubber: React.FC<DateScrubberProps> = ({ scroller, placement }) => {
  const gridOffset = placement.offset;
  const trackRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ ratio: 0, active: false, dragging: false, height: 0 });
  const idleRef = useRef(0);
  const draggingRef = useRef(false);
  // Scroll writes go through a ref: the element itself is a prop.
  const scrollerRef = useRef(scroller);
  useEffect(() => {
    scrollerRef.current = scroller;
  }, [scroller]);

  const wake = useCallback(() => {
    window.clearTimeout(idleRef.current);
    setState((current) => (current.active ? current : { ...current, active: true }));
    idleRef.current = window.setTimeout(() => {
      if (!draggingRef.current) setState((current) => ({ ...current, active: false }));
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      setState((current) => ({
        ...current,
        ratio: max > 0 ? scroller.scrollTop / max : 0,
        height: trackRef.current?.clientHeight ?? current.height,
      }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
      wake();
    };
    frame = requestAnimationFrame(read);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(idleRef.current);
    };
  }, [scroller, wake]);

  if (!scroller) return null;
  const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
  // Nothing to scrub through on a short library.
  if (scroller.scrollHeight < scroller.clientHeight * 3) return null;

  const contentHeight = Math.max(1, gridOffset + placement.height);
  const toTrack = (contentY: number) => (contentY / contentHeight) * state.height;
  const scrollFromPointer = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const box = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    const target = scrollerRef.current;
    if (target) target.scrollTop = ratio * max;
  };

  // Read the live position: the state only wakes this render.
  const ratio = Math.min(1, scroller.scrollTop / max);
  const viewY = scroller.scrollTop + scroller.clientHeight * 0.25 - gridOffset;
  const current = sectionAt(placement.sections, viewY);
  const thumbTop = ratio * Math.max(0, state.height - 44);

  let lastMark = -Infinity;
  let lastYear: number | undefined;
  const marks: { key: string; top: number; year: number }[] = [];
  for (const section of placement.sections) {
    if (section.year === undefined || section.year === lastYear) continue;
    lastYear = section.year;
    const top = toTrack(gridOffset + section.top);
    if (top - lastMark < MIN_MARK_GAP) continue;
    lastMark = top;
    marks.push({ key: section.key, top, year: section.year });
  }

  return (
    <div
      ref={trackRef}
      className="gv-scrub"
      data-active={state.active || state.dragging || undefined}
      aria-hidden="true"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        setState((value) => ({ ...value, dragging: true, active: true }));
        scrollFromPointer(event.clientY);
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) scrollFromPointer(event.clientY);
        else wake();
      }}
      onPointerUp={() => {
        draggingRef.current = false;
        setState((value) => ({ ...value, dragging: false }));
        wake();
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        setState((value) => ({ ...value, dragging: false }));
      }}
    >
      {marks.map((mark) => (
        <span key={mark.key} className="gv-scrub__year" style={{ top: mark.top }}>
          {mark.year}
        </span>
      ))}
      <span className="gv-scrub__thumb" style={{ transform: `translateY(${thumbTop}px)` }}>
        {current?.label && (state.dragging || state.active) && (
          <span className="gv-scrub__bubble">{current.label}</span>
        )}
      </span>
    </div>
  );
};
