import { useEffect, type RefObject } from "react";
import { directionFromKey, findNextFocusable, ownsArrowKeys } from "../lib/spatialNavigation";

/**
 * Moves focus with arrow keys inside `rootRef`. When nothing is focused,
 * the first arrow press lands on `[data-nav-default]` or the first focusable.
 */
export function useSpatialNavigation(rootRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const direction = directionFromKey(event.key);
      if (!root || !direction || event.defaultPrevented || event.altKey || event.metaKey) return;

      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || !root.contains(active)) {
        const start =
          root.querySelector<HTMLElement>("[data-nav-default]") ??
          root.querySelector<HTMLElement>("button:not([disabled]), a[href]");
        if (start) {
          event.preventDefault();
          start.focus();
        }
        return;
      }
      if (ownsArrowKeys(active, direction)) return;

      // Overlays (sheets, dialogs) mark themselves as scopes so focus never escapes behind them.
      const scope = active.closest<HTMLElement>("[data-nav-scope]") ?? root;
      const next = findNextFocusable(scope, active, direction);
      if (next) {
        event.preventDefault();
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rootRef, enabled]);
}
