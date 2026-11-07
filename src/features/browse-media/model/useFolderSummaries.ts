import { useEffect, useState } from "react";
import { getFolderSummaries, type FolderSummary } from "@/shared";

/** Summaries outlive one visit to a folder; bounded so a large tree cannot grow it forever. */
const cache = new Map<string, FolderSummary>();
const CACHE_LIMIT = 600;
const BATCH = 48;

function remember(summary: FolderSummary) {
  cache.delete(summary.path);
  cache.set(summary.path, summary);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Cover and count for each folder card, fetched in batches of 48 and
 * cached across visits. Unknown folders read as `undefined` until they land.
 */
export function useFolderSummaries(paths: string[]): Map<string, FolderSummary> {
  const [, setRevision] = useState(0);
  const key = paths.join("\n");

  useEffect(() => {
    const missing = paths.filter((path) => !cache.has(path));
    if (missing.length === 0) return;
    let alive = true;
    void (async () => {
      for (let index = 0; index < missing.length && alive; index += BATCH) {
        const batch = await getFolderSummaries(missing.slice(index, index + BATCH)).catch(() => []);
        batch.forEach(remember);
        if (alive) setRevision((value) => value + 1);
      }
    })();
    return () => {
      alive = false;
    };
    // `key` is the joined path list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return cache;
}
