import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * True after `minutes` without input. One timeout, reset on activity; no
 * polling. `minutes <= 0` disables it. `enabled: false` pauses it (e.g. while
 * a streaming page or an overlay is open).
 */
export function useIdle(minutes: number, enabled: boolean) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef(0);
  const active = enabled && minutes > 0;

  const arm = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (active) timerRef.current = window.setTimeout(() => setIdle(true), minutes * 60_000);
  }, [active, minutes]);

  useEffect(() => {
    if (!active) {
      window.clearTimeout(timerRef.current);
      return;
    }
    const onActivity = () => {
      if (!idle) arm();
    };
    arm();
    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, onActivity, { passive: true, capture: true }),
    );
    return () => {
      window.clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((type) =>
        window.removeEventListener(type, onActivity, { capture: true }),
      );
    };
  }, [active, arm, idle]);

  const wake = useCallback(() => {
    setIdle(false);
    arm();
  }, [arm]);

  /** Enter the ambient frame now (the explorer row's 앰비언트 button). */
  const sleep = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setIdle(true);
  }, []);

  return { idle: active ? idle : idle && enabled, wake, sleep };
}
