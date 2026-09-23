import type { FileItem, QuickLocation, MediaType } from "@/shared";

export type { FileItem, QuickLocation, MediaType };

export interface MediaItem extends FileItem {
  thumbnailUrl?: string;
  isThumbnailLoading?: boolean;
}

export type ViewLayoutMode = "grid" | "list";

export interface DirectoryState {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
  isLoading: boolean;
  error: string | null;
}
