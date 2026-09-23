export type AppCategory = "media" | "tools" | "social" | "system";

export interface AppItem {
  id: string;
  title: string;
  description?: string;
  category: AppCategory;
  url: string;
  imageUrl?: string;
  iconUrl?: string;
  imageFit?: "cover" | "contain" | "auto";
  bannerUrl?: string;
  accentColor: string;
  badge?: string;
  isExternalApp?: boolean;
}
