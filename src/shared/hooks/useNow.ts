import { useEffect, useState } from "react";

/**
 * Current time, refreshed every `intervalMs` (never faster than 10 s, per the
 * low-spec polling rule). Callers format it with their own locale.
 */
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), Math.max(10_000, intervalMs));
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
