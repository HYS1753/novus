/**
 * Low-spec throttle utility that avoids unnecessary re-renders or GC pressure.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limitMs: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limitMs);
    }
  };
}
