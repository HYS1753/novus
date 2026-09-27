import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { FileItem, QuickLocation } from "@/entities";
import { scanDirectory, getMediaPage, getSystemLocations, openFileInOs } from "@/shared";

export type SortField = "name" | "modified" | "size";
export type SortOrder = "asc" | "desc";

export interface PathBreadcrumb {
  label: string;
  path: string;
}

function buildBreadcrumbs(path: string): PathBreadcrumb[] {
  if (!path) return [];

  if (/^[A-Za-z]:[\\/]/.test(path)) {
    const parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
    const drive = parts.shift();
    if (!drive) return [];
    let accumulated = `${drive}\\`;
    return [
      { label: drive, path: accumulated },
      ...parts.map((part) => {
        accumulated = `${accumulated}${accumulated.endsWith("\\") ? "" : "\\"}${part}`;
        return { label: part, path: accumulated };
      }),
    ];
  }

  const rooted = path.startsWith("/");
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  let accumulated = rooted ? "" : parts.shift() || "";
  const breadcrumbs: PathBreadcrumb[] = rooted
    ? [{ label: "/", path: "/" }]
    : accumulated
      ? [{ label: accumulated, path: accumulated }]
      : [];

  for (const part of parts) {
    accumulated = rooted || accumulated ? `${accumulated}/${part}` : part;
    breadcrumbs.push({ label: part, path: accumulated });
  }
  return breadcrumbs;
}

interface UseFileBrowserOptions {
  filterMode: "media" | "all";
  initialPath?: string;
}

function readSavedLocation(filterMode: "media" | "all") {
  try {
    const saved = JSON.parse(localStorage.getItem(`novus.browser.${filterMode}`) || "null") as {
      path?: string;
      history?: string[];
    } | null;
    return {
      path: typeof saved?.path === "string" ? saved.path : "",
      history: Array.isArray(saved?.history)
        ? saved.history.filter((path): path is string => typeof path === "string").slice(-50)
        : [],
    };
  } catch {
    return { path: "", history: [] as string[] };
  }
}

export function useFileBrowser({ filterMode, initialPath }: UseFileBrowserOptions) {
  const [savedLocation] = useState(() => readSavedLocation(filterMode));
  const [locations, setLocations] = useState<QuickLocation[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(initialPath || savedLocation.path);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loadedMediaKey, setLoadedMediaKey] = useState("");
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>(savedLocation.history);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    if (filterMode !== "media") return;
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => window.clearTimeout(timer);
  }, [filterMode, searchQuery]);

  // Load locations on mount
  useEffect(() => {
    let isMounted = true;
    getSystemLocations()
      .then((locs) => {
        if (!isMounted) return;
        setLocations(locs);
        // Default to Pictures for media, or Home for all if initialPath not given
        if (!initialPath && !savedLocation.path && locs.length > 0) {
          const defaultLoc =
            filterMode === "media"
              ? locs.find((l) => l.category === "pictures") ||
                locs.find((l) => l.category === "videos") ||
                locs[0]
              : locs.find((l) => l.category === "home") || locs[0];
          setCurrentPath(defaultLoc.path);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(String(err));
      });

    return () => {
      isMounted = false;
    };
  }, [filterMode, initialPath, savedLocation.path]);

  useEffect(() => {
    if (!currentPath) return;
    try {
      localStorage.setItem(
        `novus.browser.${filterMode}`,
        JSON.stringify({ path: currentPath, history: navigationHistory }),
      );
    } catch {
      // Browsing still works when storage is unavailable.
    }
  }, [currentPath, filterMode, navigationHistory]);

  const [loadedDirectoryPath, setLoadedDirectoryPath] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const mediaKey = JSON.stringify([
    currentPath,
    debouncedSearchQuery,
    sortField,
    sortOrder,
    refreshVersion,
  ]);
  const isLoading =
    isRefreshing ||
    (Boolean(currentPath) && loadedDirectoryPath !== currentPath) ||
    (filterMode === "media" &&
      Boolean(currentPath) &&
      (loadedMediaKey !== mediaKey || searchQuery !== debouncedSearchQuery));

  // Load directory contents when currentPath changes
  useEffect(() => {
    if (!currentPath || filterMode === "media") return;

    let isCancelled = false;

    scanDirectory(currentPath, filterMode)
      .then((result) => {
        if (!isCancelled) {
          setParentPath(result.parent_path);
          setItems(result.items);
          setLoadedDirectoryPath(result.current_path);
          setError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(String(err));
          setLoadedDirectoryPath(currentPath);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentPath, filterMode]);

  useEffect(() => {
    if (!currentPath || filterMode !== "media") return;
    const generation = ++generationRef.current;
    let cancelled = false;
    loadingMoreRef.current = false;
    void getMediaPage({
      path: currentPath,
      searchQuery: debouncedSearchQuery,
      sortField,
      sortOrder,
    })
      .then((result) => {
        if (cancelled || generation !== generationRef.current) return;
        setParentPath(result.parent_path);
        setItems(result.items);
        setTotalCount(result.total_count);
        setImageCount(result.image_count);
        setVideoCount(result.video_count);
        setSnapshotId(result.snapshot_id);
        setHasMore(result.has_more);
        setIsLoadingMore(false);
        setLoadMoreError(null);
        setLoadedDirectoryPath(result.current_path);
        setLoadedMediaKey(mediaKey);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled && generation === generationRef.current) {
          setIsLoadingMore(false);
          setError(String(err));
          setLoadedDirectoryPath(currentPath);
          setLoadedMediaKey(mediaKey);
        }
      })
      .finally(() => {
        if (!cancelled && generation === generationRef.current) setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    currentPath,
    filterMode,
    debouncedSearchQuery,
    sortField,
    sortOrder,
    refreshVersion,
    mediaKey,
  ]);

  const loadMore = useCallback(() => {
    if (
      filterMode !== "media" ||
      !currentPath ||
      snapshotId === null ||
      !hasMore ||
      isLoading ||
      loadingMoreRef.current
    )
      return;
    loadingMoreRef.current = true;
    const generation = generationRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    void getMediaPage({
      path: currentPath,
      searchQuery: debouncedSearchQuery,
      sortField,
      sortOrder,
      snapshotId,
      offset: items.length,
    })
      .then((result) => {
        if (generation !== generationRef.current) return;
        setItems((previous) => [...previous, ...result.items]);
        setHasMore(result.has_more);
      })
      .catch((err) => {
        if (generation === generationRef.current) setLoadMoreError(String(err));
      })
      .finally(() => {
        if (generation === generationRef.current) {
          setIsLoadingMore(false);
          loadingMoreRef.current = false;
        }
      });
  }, [
    currentPath,
    debouncedSearchQuery,
    filterMode,
    hasMore,
    isLoading,
    items.length,
    snapshotId,
    sortField,
    sortOrder,
  ]);

  const refresh = useCallback(() => {
    if (!currentPath) return;
    if (filterMode === "media") {
      setIsRefreshing(true);
      setRefreshVersion((version) => version + 1);
      return;
    }
    setIsRefreshing(true);
    scanDirectory(currentPath, filterMode)
      .then((result) => {
        setParentPath(result.parent_path);
        setItems(result.items);
        setLoadedDirectoryPath(result.current_path);
        setError(null);
      })
      .catch((err) => {
        setError(String(err));
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [currentPath, filterMode]);

  const navigateTo = useCallback(
    (path: string) => {
      if (!path || path === currentPath) return;
      if (currentPath) {
        setNavigationHistory((history) => [...history, currentPath].slice(-50));
      }
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setCurrentPath(path);
    },
    [currentPath],
  );

  const navigateUp = useCallback(() => {
    if (parentPath) navigateTo(parentPath);
  }, [navigateTo, parentPath]);

  const navigateBack = useCallback(() => {
    const previousPath = navigationHistory.at(-1);
    if (!previousPath) return;
    setNavigationHistory((history) => history.slice(0, -1));
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setCurrentPath(previousPath);
  }, [navigationHistory]);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath), [currentPath]);

  const openInSystemExplorer = useCallback(async (path: string) => {
    try {
      await openFileInOs(path);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    if (filterMode === "media") return items;
    let result = items;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => {
      // Directories always on top
      if (a.is_dir !== b.is_dir) {
        return b.is_dir ? 1 : -1;
      }

      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "modified") {
        cmp = a.modified_ms - b.modified_ms;
      } else if (sortField === "size") {
        cmp = a.size - b.size;
      }

      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filterMode, items, searchQuery, sortField, sortOrder]);

  return {
    locations,
    currentPath,
    parentPath,
    breadcrumbs,
    canGoBack: navigationHistory.length > 0,
    items: filteredAndSortedItems,
    rawItemCount: items.length,
    totalCount: filterMode === "media" ? totalCount : items.length,
    imageCount,
    videoCount,
    hasMore,
    isLoadingMore,
    loadMoreError,
    loadMore,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    navigateTo,
    navigateUp,
    navigateBack,
    refresh,
    openInSystemExplorer,
  };
}
