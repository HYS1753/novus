import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMediaPage,
  getMediaTimeline,
  type FileItem,
  type MediaKind,
  type TimelineBucket,
} from "@/shared";

export type MediaSortField = "name" | "modified" | "size";
export type MediaSortOrder = "asc" | "desc";

/** Items per request; the Rust side caps a page at 120. */
export const PAGE_SIZE = 80;
/** Pages in flight at once, so a fast scrub cannot flood the backend. */
const MAX_IN_FLIGHT = 2;
/** A failed page is retried after 1s, 2s, 4s, then left until it is wanted again. */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

export interface MediaCollectionQuery {
  path: string;
  kind: MediaKind;
  recursive: boolean;
  /** Backend snapshot slot ("library" or "folder"), so tabs keep their snapshots. */
  slot: string;
  sortField: MediaSortField;
  sortOrder: MediaSortOrder;
  search: string;
  /** Load month runs for the date scrubber. */
  withTimeline?: boolean;
}

export interface MediaCollection {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Items by snapshot index; `undefined` where a page has not arrived yet. */
  items: (FileItem | undefined)[];
  total: number;
  imageCount: number;
  videoCount: number;
  truncated: boolean;
  parentPath: string | null;
  buckets: TimelineBucket[];
  /** Bumps whenever a page lands, so layouts can recompute. */
  revision: number;
  /** Loads every page touching [start, end). Cheap to call on every scroll frame. */
  ensureRange: (start: number, end: number) => void;
  /** Rebuild the snapshot; `rescan` also walks the disk again. */
  reload: (rescan?: boolean) => void;
}

/**
 * A sparse, page-on-demand view of one media snapshot. Pages load where the
 * viewer is looking (including after a scrubber jump), not front to back.
 */
export function useMediaCollection(query: MediaCollectionQuery | null): MediaCollection {
  const [status, setStatus] = useState<MediaCollection["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    total: 0,
    imageCount: 0,
    videoCount: 0,
    truncated: false,
    parentPath: null as string | null,
  });
  const [buckets, setBuckets] = useState<TimelineBucket[]>([]);
  const [revision, setRevision] = useState(0);
  const [reloadKey, setReloadKey] = useState({ version: 0, rescan: false });

  // One store per snapshot. Its array is filled in place as pages land (no
  // copying 20k entries per page); `revision` tells React it changed.
  const [store, setStore] = useState<{ items: (FileItem | undefined)[] }>({ items: [] });
  const itemsRef = useRef<(FileItem | undefined)[]>([]);
  const pumpRef = useRef<() => void>(() => undefined);
  const snapshotRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const loadedPages = useRef(new Set<number>());
  const inFlight = useRef(new Set<number>());
  const wanted = useRef<number[]>([]);
  const attempts = useRef(new Map<number, number>());
  const queryRef = useRef(query);

  const key = query
    ? JSON.stringify([
        query.path,
        query.kind,
        query.recursive,
        query.slot,
        query.sortField,
        query.sortOrder,
        query.search,
        query.withTimeline,
      ])
    : "";

  const pump = useCallback(() => {
    const current = queryRef.current;
    const snapshotId = snapshotRef.current;
    if (!current || snapshotId === null) return;
    while (inFlight.current.size < MAX_IN_FLIGHT && wanted.current.length > 0) {
      const page = wanted.current.shift();
      if (page === undefined) break;
      if (loadedPages.current.has(page) || inFlight.current.has(page)) continue;
      inFlight.current.add(page);
      const generation = generationRef.current;
      void getMediaPage({
        path: current.path,
        searchQuery: current.search,
        sortField: current.sortField,
        sortOrder: current.sortOrder,
        kind: current.kind,
        recursive: current.recursive,
        slot: current.slot,
        snapshotId,
        offset: page * PAGE_SIZE,
        pageSize: PAGE_SIZE,
      })
        .then((result) => {
          if (generation !== generationRef.current) return;
          result.items.forEach((item, index) => {
            itemsRef.current[page * PAGE_SIZE + index] = item;
          });
          loadedPages.current.add(page);
          setRevision((value) => value + 1);
        })
        .catch(() => {
          // Retry a failed page a few times with growing waits, so its tiles
          // never stay "loading" just because the reader stopped scrolling.
          const attempt = (attempts.current.get(page) ?? 0) + 1;
          attempts.current.set(page, attempt);
          if (attempt > MAX_RETRIES) return;
          window.setTimeout(
            () => {
              if (generation !== generationRef.current) return;
              if (!wanted.current.includes(page)) wanted.current.push(page);
              pumpRef.current();
            },
            RETRY_BASE_MS * 2 ** (attempt - 1),
          );
        })
        .finally(() => {
          inFlight.current.delete(page);
          if (generation === generationRef.current) pumpRef.current();
        });
    }
  }, []);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const ensureRange = useCallback(
    (start: number, end: number) => {
      const total = itemsRef.current.length;
      if (total === 0) return;
      const first = Math.max(0, Math.floor(start / PAGE_SIZE));
      const last = Math.floor((Math.min(total, end) - 1) / PAGE_SIZE);
      // The newest request wins: scrolling elsewhere drops pages no longer wanted.
      const next: number[] = [];
      for (let page = first; page <= last; page++) {
        if (!loadedPages.current.has(page) && !inFlight.current.has(page)) next.push(page);
      }
      wanted.current = next;
      pump();
    },
    [pump],
  );

  useEffect(() => {
    queryRef.current = query;
    if (!query || !query.path) return;
    const generation = ++generationRef.current;
    loadedPages.current = new Set();
    inFlight.current = new Set();
    wanted.current = [];
    attempts.current = new Map();
    snapshotRef.current = null;
    let cancelled = false;
    // Status changes are part of starting the load this effect owns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    setError(null);
    const rescan = reloadKey.rescan;
    void getMediaPage({
      path: query.path,
      searchQuery: query.search,
      sortField: query.sortField,
      sortOrder: query.sortOrder,
      kind: query.kind,
      recursive: query.recursive,
      slot: query.slot,
      rescan,
      pageSize: PAGE_SIZE,
    })
      .then(async (result) => {
        if (cancelled || generation !== generationRef.current) return;
        const items: (FileItem | undefined)[] = new Array(result.total_count);
        result.items.forEach((item, index) => {
          items[index] = item;
        });
        itemsRef.current = items;
        setStore({ items });
        loadedPages.current.add(0);
        snapshotRef.current = result.snapshot_id;
        setMeta({
          total: result.total_count,
          imageCount: result.image_count,
          videoCount: result.video_count,
          truncated: result.truncated,
          parentPath: result.parent_path,
        });
        let timeline: TimelineBucket[] = [];
        if (query.withTimeline && result.total_count > 0) {
          timeline = await getMediaTimeline(result.snapshot_id).catch(() => []);
          if (cancelled || generation !== generationRef.current) return;
        }
        setBuckets(timeline);
        setRevision((value) => value + 1);
        setStatus("ready");
      })
      .catch((reason) => {
        if (cancelled || generation !== generationRef.current) return;
        itemsRef.current = [];
        setStore({ items: [] });
        setMeta({ total: 0, imageCount: 0, videoCount: 0, truncated: false, parentPath: null });
        setBuckets([]);
        setError(String(reason));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // `key` captures every query field that changes the snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadKey]);

  const reload = useCallback((rescan = false) => {
    setReloadKey((value) => ({ version: value.version + 1, rescan }));
  }, []);

  return {
    status,
    error,
    items: store.items,
    ...meta,
    buckets,
    revision,
    ensureRange,
    reload,
  };
}
