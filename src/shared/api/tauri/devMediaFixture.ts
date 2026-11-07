/**
 * Browser dev server only, and only when opted in:
 *   localStorage.setItem("novus.dev.mediaFixture", "1")
 *
 * Stands in for the Rust media commands so the gallery can be built and
 * checked in a browser, where there is no file system. It is loaded with a
 * dynamic import behind `import.meta.env.DEV`, so production builds never
 * contain it. Paths are bundled artwork URLs with a `#n` suffix.
 */
import type {
  DirectoryScanResult,
  FileItem,
  FolderSummary,
  MediaPageResult,
  QuickLocation,
  TimelineBucket,
} from "./mediaFs";
import { BUNDLED_AMBIENT_ARTWORK } from "../../lib/ambientArtwork";

const ROOT = "/dev/Pictures";
const FOLDERS = ["여행", "가족", "스크린샷"];
const COUNT = 640;
const DAY = 86_400_000;
/** Aspect ratios a real library mixes: 3:2, 4:3, 2:3 portrait, 16:9, square. */
const SHAPES: [number, number][] = [
  [3000, 2000],
  [4032, 3024],
  [2000, 3000],
  [1920, 1080],
  [2048, 2048],
  [3024, 4032],
];

export const devFixtureEnabled = () => {
  try {
    return localStorage.getItem("novus.dev.mediaFixture") === "1";
  } catch {
    return false;
  }
};

let library: FileItem[] | null = null;

function buildLibrary(): FileItem[] {
  if (library) return library;
  const art = BUNDLED_AMBIENT_ARTWORK.map((entry) => entry.url);
  const now = Date.UTC(2026, 10, 6, 6);
  library = Array.from({ length: COUNT }, (_, index) => {
    const folder = FOLDERS[index % FOLDERS.length];
    const video = index % 17 === 5;
    const [width, height] = SHAPES[(index * 7) % SHAPES.length];
    // Denser recent months, sparser years back: about 20 months in all.
    const age = Math.floor((index / COUNT) ** 1.6 * 600) * DAY + (index % 9) * 3_600_000;
    const name = video ? `clip_${index}.mp4` : `IMG_${String(4000 - index).padStart(4, "0")}.jpg`;
    return {
      name,
      path: video
        ? `dev://${folder}/${name}`
        : `${art[index % Math.max(1, art.length)]}#${folder}/${index}`,
      is_dir: false,
      size: 1_200_000 + ((index * 7919) % 6_000_000),
      modified_ms: now - age,
      extension: video ? "mp4" : "jpg",
      media_type: video ? "video" : "image",
      ...(video ? {} : { width, height }),
    };
  });
  return library;
}

function folderOf(item: FileItem) {
  return item.path.split("#")[1]?.split("/")[0] ?? item.path.split("/")[2];
}

interface Snapshot {
  id: number;
  path: string;
  items: FileItem[];
}

const snapshots = new Map<string, Snapshot>();
let nextId = 1;

export async function devGetMediaPage(options: {
  path: string;
  searchQuery: string;
  sortField: "name" | "modified" | "size";
  sortOrder: "asc" | "desc";
  snapshotId?: number;
  offset?: number;
  pageSize?: number;
  kind?: string;
  recursive?: boolean;
  slot?: string;
}): Promise<MediaPageResult> {
  // A little latency so loading states are visible.
  await new Promise((resolve) => setTimeout(resolve, 120));
  const slot = options.slot ?? "default";
  let snapshot =
    options.snapshotId !== undefined
      ? [...snapshots.values()].find((entry) => entry.id === options.snapshotId)
      : undefined;
  if (!snapshot) {
    const all = buildLibrary();
    const inFolder = options.path === ROOT ? null : options.path.split("/").pop();
    let items: FileItem[];
    if (options.recursive) {
      items = all.filter((item) => !inFolder || folderOf(item) === inFolder);
    } else if (!inFolder) {
      items = FOLDERS.map((name) => ({
        name,
        path: `${ROOT}/${name}`,
        is_dir: true,
        size: 0,
        modified_ms: 0,
        extension: "",
        media_type: "directory" as const,
      }));
    } else {
      items = all.filter((item) => folderOf(item) === inFolder);
    }
    const needle = options.searchQuery.trim().toLowerCase();
    items = items
      .filter((item) => {
        if (options.kind === "media") return !item.is_dir;
        if (options.kind === "image") return item.media_type === "image";
        if (options.kind === "video") return item.media_type === "video";
        return true;
      })
      .filter((item) => !needle || item.name.toLowerCase().includes(needle));
    const direction = options.sortOrder === "desc" ? -1 : 1;
    items.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const order =
        options.sortField === "modified"
          ? a.modified_ms - b.modified_ms
          : options.sortField === "size"
            ? a.size - b.size
            : a.name.localeCompare(b.name, undefined, { numeric: true });
      return order * direction;
    });
    snapshot = { id: nextId++, path: options.path, items };
    snapshots.set(slot, snapshot);
  }
  const offset = options.offset ?? 0;
  const end = Math.min(snapshot.items.length, offset + Math.min(120, options.pageSize ?? 80));
  return {
    current_path: snapshot.path,
    parent_path: snapshot.path === ROOT ? "/dev" : ROOT,
    snapshot_id: snapshot.id,
    total_count: snapshot.items.length,
    image_count: snapshot.items.filter((item) => item.media_type === "image").length,
    video_count: snapshot.items.filter((item) => item.media_type === "video").length,
    items: snapshot.items.slice(offset, end),
    has_more: end < snapshot.items.length,
    truncated: false,
  };
}

export async function devGetMediaTimeline(snapshotId: number): Promise<TimelineBucket[]> {
  const snapshot = [...snapshots.values()].find((entry) => entry.id === snapshotId);
  if (!snapshot) throw new Error("Media snapshot expired");
  const buckets: TimelineBucket[] = [];
  snapshot.items.forEach((item, index) => {
    if (item.is_dir) return;
    const date = new Date(item.modified_ms);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const last = buckets.at(-1);
    if (last && last.year === year && last.month === month) last.count += 1;
    else buckets.push({ year, month, count: 1, first_index: index });
  });
  return buckets;
}

export function devSystemLocations(): QuickLocation[] {
  return [
    { name: "사진", path: ROOT, category: "pictures" },
    { name: "다운로드", path: "/dev/Downloads", category: "downloads" },
  ];
}

/** The fixture's "thumbnail" is the artwork itself (strip the uniqueness suffix). */
export function devThumbnail(path: string): string {
  return path.startsWith("dev://") ? "" : path.split("#")[0];
}

export async function devFolderSummaries(paths: string[]): Promise<FolderSummary[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  const all = buildLibrary();
  return paths.slice(0, 48).map((path) => {
    const name = path.split("/").pop();
    const inside = all.filter((item) => folderOf(item) === name);
    const cover = inside
      .filter((item) => item.media_type === "image")
      .sort((a, b) => b.modified_ms - a.modified_ms)[0];
    return { path, media_count: inside.length, cover: cover ?? null, has_subfolders: false };
  });
}

/** Folder listing for the Files screen: folders, the library's media, and a few documents. */
export async function devScanDirectory(path: string): Promise<DirectoryScanResult> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const all = buildLibrary();
  const name = path.split("/").pop() ?? "";
  const docs: FileItem[] = ["회의록.pdf", "예산.xlsx", "메모.txt", "backup.zip"].map(
    (file, index) => ({
      name: file,
      path: `${path}/${file}`,
      is_dir: false,
      size: 24_000 * (index + 3),
      modified_ms: Date.UTC(2026, 9, 20 - index),
      extension: file.split(".").pop() ?? "",
      media_type: file.endsWith(".zip") ? "archive" : "document",
    }),
  );
  const folders: FileItem[] =
    path === ROOT || path === "/dev/Downloads"
      ? FOLDERS.map((folder) => ({
          name: folder,
          path: `${ROOT}/${folder}`,
          is_dir: true,
          size: 0,
          modified_ms: Date.UTC(2026, 10, 1),
          extension: "",
          media_type: "directory" as const,
        }))
      : [];
  const media = FOLDERS.includes(name) ? all.filter((item) => folderOf(item) === name) : [];
  return {
    current_path: path,
    parent_path: path === ROOT ? "/dev" : ROOT,
    items: [...folders, ...docs, ...media],
  };
}
