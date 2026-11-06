import { invoke, convertFileSrc as tauriConvertFileSrc } from "@tauri-apps/api/core";
import { queueThumbnail } from "./thumbnailQueue";
import { isTauriRuntime } from "../../lib/runtime";

/** Dev-only browser stand-in for the media commands (opt-in, never in production builds). */
async function devFixture() {
  if (!import.meta.env.DEV || isTauriRuntime()) return null;
  const fixture = await import("./devMediaFixture");
  return fixture.devFixtureEnabled() ? fixture : null;
}

/**
 * Local file → URL the webview can load. Outside Tauri (the browser dev
 * server) there is no asset protocol, so the path is returned unchanged
 * instead of throwing and taking the page down.
 */
export function convertFileSrc(path: string, protocol?: string): string {
  return isTauriRuntime() ? tauriConvertFileSrc(path, protocol) : path;
}

export interface QuickLocation {
  name: string;
  path: string;
  category: "drive" | "home" | "pictures" | "videos" | "downloads" | "documents" | "desktop";
}

export type MediaType =
  "directory" | "image" | "video" | "audio" | "document" | "archive" | "other";

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
  extension: string;
  media_type: MediaType;
  /** Displayed image size (EXIF orientation applied); absent for folders, videos, unreadable formats. */
  width?: number;
  height?: number;
}

export interface DirectoryScanResult {
  current_path: string;
  parent_path: string | null;
  items: FileItem[];
}

export interface MediaPageResult {
  current_path: string;
  parent_path: string | null;
  snapshot_id: number;
  total_count: number;
  image_count: number;
  video_count: number;
  items: FileItem[];
  has_more: boolean;
  /** The recursive scan stopped at its 20,000-file limit. */
  truncated: boolean;
}

/** "all": folders + media (folder view) · "media": images + videos · "image" · "video". */
export type MediaKind = "all" | "media" | "image" | "video";

/** A run of consecutive snapshot items in one calendar month (local time). */
export interface TimelineBucket {
  year: number;
  month: number;
  count: number;
  first_index: number;
}

export async function getMediaPage(options: {
  path: string;
  searchQuery: string;
  sortField: "name" | "modified" | "size";
  sortOrder: "asc" | "desc";
  snapshotId?: number;
  offset?: number;
  pageSize?: number;
  kind?: MediaKind;
  /** Walk every subfolder (timeline). Bounded to 20,000 files and 8 levels. */
  recursive?: boolean;
  /** Live snapshot to replace ("library" for the timeline, "folder" for the folder view). */
  slot?: string;
  /** Walk the disk again instead of reusing a walk from the last two minutes. */
  rescan?: boolean;
}): Promise<MediaPageResult> {
  const fixture = await devFixture();
  if (fixture) return fixture.devGetMediaPage(options);
  return await invoke<MediaPageResult>("get_media_page", {
    path: options.path,
    searchQuery: options.searchQuery,
    sortField: options.sortField,
    sortOrder: options.sortOrder,
    snapshotId: options.snapshotId ?? null,
    offset: options.offset ?? 0,
    pageSize: options.pageSize ?? 80,
    kind: options.kind ?? "all",
    recursive: options.recursive ?? false,
    slot: options.slot ?? "default",
    rescan: options.rescan ?? false,
  });
}

/** A folder card: media held directly, the newest image as cover, and whether it nests. */
export interface FolderSummary {
  path: string;
  media_count: number;
  cover: FileItem | null;
  has_subfolders: boolean;
}

/** Cover and count for up to 48 folders per call. */
export async function getFolderSummaries(paths: string[]): Promise<FolderSummary[]> {
  const fixture = await devFixture();
  if (fixture) return fixture.devFolderSummaries(paths);
  return await invoke<FolderSummary[]>("get_folder_summaries", { paths });
}

/** Month runs of the current snapshot, for the date scrubber. */
export async function getMediaTimeline(snapshotId: number): Promise<TimelineBucket[]> {
  const fixture = await devFixture();
  if (fixture) return fixture.devGetMediaTimeline(snapshotId);
  return await invoke<TimelineBucket[]>("get_media_timeline", {
    snapshotId,
    // getTimezoneOffset() is minutes *behind* UTC; the command wants minutes ahead.
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });
}

export interface PlayResult {
  success: boolean;
  used_mpv: boolean;
  message: string;
}

/**
 * Retrieve system drives and quick bookmark folders
 */
export async function getSystemLocations(): Promise<QuickLocation[]> {
  const fixture = await devFixture();
  if (fixture) return fixture.devSystemLocations();
  return await invoke<QuickLocation[]>("get_system_locations");
}

/**
 * Scan directory with filter mode ("media" | "all")
 */
export async function scanDirectory(
  path: string,
  filterMode: "media" | "all" = "all",
): Promise<DirectoryScanResult> {
  return await invoke<DirectoryScanResult>("scan_directory", {
    path,
    filterMode,
  });
}

/**
 * Open file or folder with OS default application
 */
export async function openFileInOs(path: string): Promise<void> {
  await invoke<void>("open_file_in_os", { path });
}

/** Bounded, prioritized thumbnail requests with a small in-memory URI cache. */
export async function getImageThumbnail(
  filePath: string,
  maxDim = 256,
  priority = 0,
  signal?: AbortSignal,
  version?: string,
): Promise<string> {
  const fixture = await devFixture();
  if (fixture) return fixture.devThumbnail(filePath);
  return await queueThumbnail(filePath, maxDim, priority, signal, version);
}

/**
 * Clean up temporary thumbnail session directory
 */
export async function cleanupThumbnailCache(): Promise<void> {
  await invoke<void>("cleanup_thumbnail_cache");
}

/**
 * Play video with native MPV hardware acceleration engine or fallback
 */
export async function playVideoNative(filePath: string): Promise<PlayResult> {
  return await invoke<PlayResult>("play_video_native", {
    filePath,
  });
}
