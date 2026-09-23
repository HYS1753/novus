import { useState, useEffect, useCallback, useMemo } from "react";
import type { FileItem, QuickLocation } from "@/entities";
import { scanDirectory, getSystemLocations, openFileInOs } from "@/shared";

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

export function useFileBrowser({ filterMode, initialPath }: UseFileBrowserOptions) {
  const [locations, setLocations] = useState<QuickLocation[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(initialPath || "");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Load locations on mount
  useEffect(() => {
    let isMounted = true;
    getSystemLocations()
      .then((locs) => {
        if (!isMounted) return;
        setLocations(locs);
        // Default to Pictures for media, or Home for all if initialPath not given
        if (!initialPath && locs.length > 0) {
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
  }, [filterMode, initialPath]);

  const [loadedDirectoryPath, setLoadedDirectoryPath] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const isLoading = isRefreshing || (Boolean(currentPath) && loadedDirectoryPath !== currentPath);

  // Load directory contents when currentPath changes
  useEffect(() => {
    if (!currentPath) return;

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

  const refresh = useCallback(() => {
    if (!currentPath) return;
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
  }, [items, searchQuery, sortField, sortOrder]);

  return {
    locations,
    currentPath,
    parentPath,
    breadcrumbs,
    canGoBack: navigationHistory.length > 0,
    items: filteredAndSortedItems,
    rawItemCount: items.length,
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
