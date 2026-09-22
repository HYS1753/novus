export type AppCategory = "media" | "tools" | "social" | "system";

export interface AppItem {
  id: string;
  title: string;
  description?: string;
  category: AppCategory;
  url: string;
  iconUrl?: string;
  bannerUrl?: string;
  accentColor: string;
  isExternalApp?: boolean;
}
