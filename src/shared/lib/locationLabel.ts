import type { QuickLocation } from "../api/tauri/mediaFs";

type Translate = (key: never, values?: Record<string, string | number>) => string;

const CATEGORY_KEY = {
  home: "location.home",
  pictures: "location.pictures",
  videos: "location.videos",
  downloads: "location.downloads",
  documents: "location.documents",
  desktop: "location.desktop",
} as const;

/**
 * A location's display name in the UI language. The OS reports standard
 * folders by their English names ("Downloads"); drives keep their own
 * name ("C:\\", a volume label).
 */
export function locationLabel(t: Translate, location: QuickLocation): string {
  if (location.category === "drive") return location.name;
  const key = CATEGORY_KEY[location.category];
  return key ? t(key as never) : location.name;
}
