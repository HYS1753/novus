import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { queueThumbnail } from "./thumbnailQueue";

export { convertFileSrc };

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
}

export async function getMediaPage(options: {
  path: string;
  searchQuery: string;
  sortField: "name" | "modified" | "size";
  sortOrder: "asc" | "desc";
  snapshotId?: number;
  offset?: number;
  pageSize?: number;
}): Promise<MediaPageResult> {
  return await invoke<MediaPageResult>("get_media_page", {
    path: options.path,
    searchQuery: options.searchQuery,
    sortField: options.sortField,
    sortOrder: options.sortOrder,
    snapshotId: options.snapshotId ?? null,
    offset: options.offset ?? 0,
    pageSize: options.pageSize ?? 80,
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
