import { useEffect, type RefObject } from "react";

/** Movement before a press becomes a drag (so taps still reach buttons). */
const DRAG_SLOP = 8;
/** Past this share of the frame, a slow release still turns the page. */
const TURN_SHARE = 0.18;
/** A flick faster than this (px/ms) turns the page once it has travelled FLICK_MIN px. */
const FLICK_SPEED = 0.45;
const FLICK_MIN = 64;
/** Beyond the first or last frame the page follows the finger this much. */
const EDGE_RESISTANCE = 0.3;
const SETTLE_MS = 380;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Press and pull the home between its two frames, as a sheet: the photo
 * fold follows the finger (or mouse, or pen) and the release settles on
 * the nearer frame, or the next one after a flick. The wheel and the
 * buttons keep working; a drag swallows the click that would follow it.
 *
 * Scroll snapping is paused while the hand (or the settle) moves the page
 * and restored afterwards.
 */
export function useFrameDrag(scrollerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !enabled) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let pointerId: number | null = null;
    let startY = 0;
    let startX = 0;
    let startTop = 0;
    let dragging = false;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let settleFrame = 0;
    let swallowClick = false;

    const frames = () => Math.max(0, Math.round(scroller.scrollHeight / scroller.clientHeight) - 1);
    const pauseSnap = () => {
      scroller.style.scrollSnapType = "none";
    };
    const restoreSnap = () => {
      scroller.style.scrollSnapType = "";
    };

    const settleTo = (target: number) => {
      cancelAnimationFrame(settleFrame);
      const from = scroller.scrollTop;
      if (reduced || Math.abs(target - from) < 1) {
        scroller.scrollTop = target;
        restoreSnap();
        return;
      }
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / SETTLE_MS);
        scroller.scrollTop = from + (target - from) * easeOut(t);
        if (t < 1) settleFrame = requestAnimationFrame(step);
        else restoreSnap();
      };
      settleFrame = requestAnimationFrame(step);
    };

    const onDown = (event: PointerEvent) => {
      if (pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
      cancelAnimationFrame(settleFrame);
      pointerId = event.pointerId;
      startY = lastY = event.clientY;
      startX = event.clientX;
      startTop = scroller.scrollTop;
      lastTime = event.timeStamp;
      velocity = 0;
      dragging = false;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dy = event.clientY - startY;
      if (!dragging) {
        // Only a mostly vertical pull is a page turn; sideways belongs to rows.
        if (Math.abs(dy) < DRAG_SLOP || Math.abs(dy) < Math.abs(event.clientX - startX)) return;
        dragging = true;
        pauseSnap();
        scroller.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      const max = frames() * scroller.clientHeight;
      let top = startTop - dy;
      if (top < 0) top *= EDGE_RESISTANCE;
      else if (top > max) top = max + (top - max) * EDGE_RESISTANCE;
      scroller.scrollTop = top;
      const elapsed = event.timeStamp - lastTime;
      if (elapsed > 0) velocity = (event.clientY - lastY) / elapsed;
      lastY = event.clientY;
      lastTime = event.timeStamp;
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      swallowClick = true;
      const height = scroller.clientHeight;
      const from = Math.round(startTop / height);
      const moved = (startTop - scroller.scrollTop) / height; // >0 pulled down
      let target = from;
      const travelled = Math.abs(startTop - scroller.scrollTop);
      if (Math.abs(velocity) > FLICK_SPEED && travelled > FLICK_MIN)
        target = from + (velocity < 0 ? 1 : -1);
      else if (Math.abs(moved) > TURN_SHARE) target = from + (moved < 0 ? 1 : -1);
      target = Math.min(frames(), Math.max(0, target));
      settleTo(target * height);
    };

    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (dragging) {
        dragging = false;
        settleTo(Math.round(startTop / scroller.clientHeight) * scroller.clientHeight);
      }
    };

    // The click a drag would otherwise fire on the tile under the finger.
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onDragStart = (event: DragEvent) => event.preventDefault();

    scroller.addEventListener("pointerdown", onDown);
    scroller.addEventListener("pointermove", onMove, { passive: false });
    scroller.addEventListener("pointerup", onUp);
    scroller.addEventListener("pointercancel", onCancel);
    scroller.addEventListener("click", onClick, true);
    scroller.addEventListener("dragstart", onDragStart);
    return () => {
      cancelAnimationFrame(settleFrame);
      restoreSnap();
      scroller.removeEventListener("pointerdown", onDown);
      scroller.removeEventListener("pointermove", onMove);
      scroller.removeEventListener("pointerup", onUp);
      scroller.removeEventListener("pointercancel", onCancel);
      scroller.removeEventListener("click", onClick, true);
      scroller.removeEventListener("dragstart", onDragStart);
    };
  }, [enabled, scrollerRef]);
}
