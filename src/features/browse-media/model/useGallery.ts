import { useCallback, useEffect, useMemo, useState } from "react";
import { getSystemLocations, usePreference, type QuickLocation } from "@/shared";
import {
  useMediaCollection,
  type MediaCollectionQuery,
  type MediaSortField,
  type MediaSortOrder,
} from "./useMediaCollection";

/** "home" is the TV posture's shelf view; tablet posture never shows it. */
export type GalleryTab = "home" | "photos" | "folders" | "videos";

export interface GallerySort {
  field: MediaSortField;
  order: MediaSortOrder;
}

export interface GalleryCrumb {
  label: string;
  path: string;
}

const STORAGE_KEY = "novus.gallery.v2";

/** Time first for the libraries, names first for folders (as file managers do). */
const DEFAULT_SORT: Record<GalleryTab, GallerySort> = {
  home: { field: "modified", order: "desc" },
  photos: { field: "modified", order: "desc" },
  videos: { field: "modified", order: "desc" },
  folders: { field: "name", order: "asc" },
};

interface Saved {
  root: string;
  tab: GalleryTab;
  folder: string;
  sort: Record<GalleryTab, GallerySort>;
}

function readSaved(): Partial<Saved> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<Saved> | null;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const separator = (path: string) => (path.includes("\\") ? "\\" : "/");

/** Folder trail from the chosen location down to `folder`, labelled with the location's name. */
function crumbsWithin(root: string, rootLabel: string, folder: string): GalleryCrumb[] {
  if (!root || !folder.startsWith(root)) return [{ label: rootLabel, path: root }];
  const sep = separator(root);
  const rest = folder.slice(root.length).split(/[\\/]/).filter(Boolean);
  let path = root;
  return [
    { label: rootLabel, path: root },
    ...rest.map((part) => {
      path = `${path}${path.endsWith(sep) ? "" : sep}${part}`;
      return { label: part, path };
    }),
  ];
}

/**
 * The gallery's state: which location, which tab, where the folder view is,
 * the search, and a sort per tab. Owns two media collections — the library
 * (photos or videos across every subfolder) and the current folder — so
 * switching tabs never rebuilds the other one.
 */
export function useGallery() {
  const [saved] = useState(readSaved);
  const [locations, setLocations] = useState<QuickLocation[]>([]);
  const [root, setRootState] = useState(saved.root ?? "");
  const [posture] = usePreference("posture");
  const tv = posture === "tv";
  const [storedTab, setTabState] = useState<GalleryTab>(saved.tab ?? (tv ? "home" : "photos"));
  // The shelf view belongs to TV posture; a tablet shows the timeline instead.
  const tab: GalleryTab = !tv && storedTab === "home" ? "photos" : storedTab;
  const [folder, setFolder] = useState(saved.folder ?? saved.root ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSortState] = useState<Record<GalleryTab, GallerySort>>({
    ...DEFAULT_SORT,
    ...saved.sort,
  });

  useEffect(() => {
    let alive = true;
    getSystemLocations()
      .then((list) => {
        if (!alive) return;
        setLocations(list);
        if (!root && list.length > 0) {
          const fallback =
            list.find((entry) => entry.category === "pictures") ??
            list.find((entry) => entry.category === "videos") ??
            list[0];
          setRootState(fallback.path);
          setFolder(fallback.path);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // Locations load once; the stored root wins when present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!root) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ root, tab: storedTab, folder, sort }));
    } catch {
      // Browsing still works without storage.
    }
  }, [root, storedTab, folder, sort]);

  const libraryTab: GalleryTab = tab === "videos" ? "videos" : "photos";
  const libraryQuery = useMemo<MediaCollectionQuery | null>(
    () =>
      root
        ? {
            path: root,
            kind: libraryTab === "videos" ? "video" : "media",
            recursive: true,
            slot: "library",
            sortField: sort[libraryTab].field,
            sortOrder: sort[libraryTab].order,
            search: tab === "folders" || tab === "home" ? "" : debounced,
            withTimeline: true,
          }
        : null,
    [debounced, libraryTab, root, sort, tab],
  );
  const folderQuery = useMemo<MediaCollectionQuery | null>(
    () =>
      tab === "folders" && folder
        ? {
            path: folder,
            kind: "all",
            recursive: false,
            slot: "folder",
            sortField: sort.folders.field,
            sortOrder: sort.folders.order,
            search: debounced,
          }
        : null,
    [debounced, folder, sort.folders, tab],
  );

  const library = useMediaCollection(tab === "folders" ? null : libraryQuery);
  const folderView = useMediaCollection(folderQuery);

  // TV shelves: recent videos and the location's folders, alongside recent photos (library).
  const videoShelfQuery = useMemo<MediaCollectionQuery | null>(
    () =>
      tab === "home" && root
        ? {
            path: root,
            kind: "video",
            recursive: true,
            slot: "videos",
            sortField: "modified",
            sortOrder: "desc",
            search: "",
          }
        : null,
    [root, tab],
  );
  const folderShelfQuery = useMemo<MediaCollectionQuery | null>(
    () =>
      tab === "home" && root
        ? {
            path: root,
            kind: "all",
            recursive: false,
            slot: "folder",
            sortField: "name",
            sortOrder: "asc",
            search: "",
          }
        : null,
    [root, tab],
  );
  const videoShelf = useMediaCollection(videoShelfQuery);
  const folderShelf = useMediaCollection(folderShelfQuery);

  const location = locations.find((entry) => entry.path === root);
  const rootLabel = location?.name ?? root.split(/[\\/]/).filter(Boolean).pop() ?? root;
  const crumbs = useMemo(() => crumbsWithin(root, rootLabel, folder), [folder, root, rootLabel]);

  const setTab = useCallback((next: GalleryTab) => {
    setTabState(next);
    setSearch("");
    setDebounced("");
  }, []);

  const setRoot = useCallback((path: string) => {
    setRootState(path);
    setFolder(path);
    setHistory([]);
    setSearch("");
    setDebounced("");
  }, []);

  const openFolder = useCallback(
    (path: string) => {
      if (path === folder) return;
      setHistory((previous) => [...previous, folder].slice(-50));
      setFolder(path);
      setSearch("");
      setDebounced("");
    },
    [folder],
  );

  /** One step back inside the folder view; false when there is nowhere to go. */
  const folderBack = useCallback((): boolean => {
    const previous = history.at(-1);
    if (previous === undefined) return false;
    setHistory((list) => list.slice(0, -1));
    setFolder(previous);
    return true;
  }, [history]);

  const setSort = useCallback(
    (next: GallerySort) => {
      setSortState((current) => ({ ...current, [tab]: next }));
    },
    [tab],
  );

  const reload = useCallback(() => {
    if (tab === "folders") folderView.reload();
    else library.reload(true);
    if (tab === "home") {
      videoShelf.reload();
      folderShelf.reload();
    }
  }, [folderShelf, folderView, library, tab, videoShelf]);

  return {
    locations,
    root,
    rootLabel,
    setRoot,
    tab,
    setTab,
    search,
    setSearch,
    sort: sort[tab],
    setSort,
    library,
    videoShelf,
    folderShelf,
    tv,
    folder,
    folderView,
    crumbs,
    openFolder,
    folderBack,
    canFolderBack: tab === "folders" && history.length > 0,
    reload,
  };
}

export type GalleryState = ReturnType<typeof useGallery>;
