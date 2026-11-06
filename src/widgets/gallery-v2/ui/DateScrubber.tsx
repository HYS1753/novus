import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GridPlacement, PlacedSection } from "./JustifiedGrid";

export interface DateScrubberProps {
  scroller: HTMLElement | null;
  placement: GridPlacement;
}

/** Shown while scrolling, then fades after this long without movement. */
const IDLE_MS = 1400;
/** Year marks closer than this (px) to the previous one are skipped. */
const MIN_MARK_GAP = 22;
const THUMB_HEIGHT = 44;

function sectionAt(sections: PlacedSection[], y: number): PlacedSection | undefined {
  let found: PlacedSection | undefined;
  for (const section of sections) {
    if (section.top > y) break;
    found = section;
  }
  return found ?? sections[0];
}

interface ScrubState {
  active: boolean;
  dragging: boolean;
  /** Track height in px. */
  height: number;
  /** Long enough to be worth scrubbing (three screens or more). */
  scrollable: boolean;
  /** Key of the section under the reading line (25% down the viewport). */
  sectionKey: string;
}

/**
 * The timeline's fast lane (Google Photos style): a thin handle on the
 * right edge that appears while scrolling. Dragging it, or pressing
 * anywhere on the track, moves through the library, with a bubble naming
 * the month under it and the years marked along the track.
 *
 * Scrolling moves the handle through a ref (transform only); React state
 * changes only when the month under the reading line changes.
 */
export const DateScrubber: React.FC<DateScrubberProps> = ({ scroller, placement }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<ScrubState>({
    active: false,
    dragging: false,
    height: 0,
    scrollable: false,
    sectionKey: "",
  });
  const idleRef = useRef(0);
  const draggingRef = useRef(false);
  const placementRef = useRef(placement);
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

  const readRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const { sections, offset } = placementRef.current;
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      const height = trackRef.current?.clientHeight ?? 0;
      const ratio = Math.min(1, scroller.scrollTop / max);
      if (thumbRef.current) {
        thumbRef.current.style.transform = `translateY(${ratio * Math.max(0, height - THUMB_HEIGHT)}px)`;
      }
      const viewY = scroller.scrollTop + scroller.clientHeight * 0.25 - offset;
      const sectionKey = sectionAt(sections, viewY)?.key ?? "";
      const scrollable = scroller.scrollHeight >= scroller.clientHeight * 3;
      setState((current) =>
        current.sectionKey === sectionKey &&
        current.height === height &&
        current.scrollable === scrollable
          ? current
          : { ...current, sectionKey, height, scrollable },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    readRef.current = schedule;
    const onScroll = () => {
      schedule();
      wake();
    };
    schedule();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(idleRef.current);
    };
  }, [scroller, wake]);

  useLayoutEffect(() => {
    placementRef.current = placement;
    readRef.current();
  }, [placement]);

  // The track must exist for its height to be read, so it renders (empty)
  // while short; only its contents wait for a long library.
  const scrollFromPointer = (clientY: number) => {
    const track = trackRef.current;
    const target = scrollerRef.current;
    if (!track || !target) return;
    const box = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
  };

  const contentHeight = Math.max(1, placement.offset + placement.height);
  const current = placement.sections.find((section) => section.key === state.sectionKey);

  let lastMark = -Infinity;
  let lastYear: number | undefined;
  const marks: { key: string; top: number; year: number }[] = [];
  for (const section of placement.sections) {
    if (section.year === undefined || section.year === lastYear) continue;
    lastYear = section.year;
    const top = ((placement.offset + section.top) / contentHeight) * state.height;
    if (top - lastMark < MIN_MARK_GAP) continue;
    lastMark = top;
    marks.push({ key: section.key, top, year: section.year });
  }

  const shown = state.active || state.dragging;

  return (
    <div
      ref={trackRef}
      className="gv-scrub"
      hidden={!scroller || !state.scrollable}
      data-active={shown || undefined}
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
      <span ref={thumbRef} className="gv-scrub__thumb">
        <span className="gv-scrub__bar" />
        {current?.label && shown && <span className="gv-scrub__bubble">{current.label}</span>}
      </span>
    </div>
  );
};
