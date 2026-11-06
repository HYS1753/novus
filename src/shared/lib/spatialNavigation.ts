/**
 * Arrow-key spatial navigation for TV posture and remotes, without a package.
 * From the focused element, it picks the nearest focusable element whose
 * centre lies in the pressed direction, weighting off-axis distance so a
 * row or column is preferred over a diagonal jump.
 */
export type NavDirection = "up" | "down" | "left" | "right";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const KEY_TO_DIRECTION: Record<string, NavDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function directionFromKey(key: string): NavDirection | undefined {
  return KEY_TO_DIRECTION[key];
}

function isVisible(element: HTMLElement): boolean {
  if (element.closest("[inert], [aria-hidden='true']")) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Elements that own their arrow keys (text fields, radio groups, sliders). */
export function ownsArrowKeys(element: Element | null, direction: NavDirection): boolean {
  if (!element) return false;
  if (element instanceof HTMLInputElement) {
    const textual = ["text", "search", "url", "email", "password", "number"].includes(element.type);
    if (textual || element.type === "range") return direction === "left" || direction === "right";
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element.closest("[data-nav-own-arrows]")) return true;
  // Radio groups move their choice sideways; up/down leaves the group.
  if (element.closest('[role="radiogroup"]')) return direction === "left" || direction === "right";
  return false;
}

export function findNextFocusable(
  root: HTMLElement,
  from: HTMLElement,
  direction: NavDirection,
): HTMLElement | null {
  const origin = from.getBoundingClientRect();
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  root.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((candidate) => {
    if (candidate === from || !isVisible(candidate)) return;
    const rect = candidate.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - ox;
    const dy = cy - oy;

    const primary =
      direction === "right" ? dx : direction === "left" ? -dx : direction === "down" ? dy : -dy;
    if (primary <= 1) return;
    const offAxis = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary + offAxis * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  });

  return best;
}
