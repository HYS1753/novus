import type { AppItem } from "./types";

/** Every launchable item on the hub, in display order. */
export const STREAMING_APPS: AppItem[] = [
  {
    id: "netflix",
    title: "Netflix",
    category: "media",
    url: "https://www.netflix.com",
    imageUrl:
      "https://images.ctfassets.net/y2ske730sjqp/5QQ9SVIdc1tmkqrtFnG9U1/de758bba0f65dcc1c6bc1f31f161003d/BrandAssets_Logos_02-NSymbol.jpg?w=940",
    accentColor: "#E50914",
  },
  {
    id: "youtube",
    title: "YouTube",
    category: "media",
    url: "https://www.youtube.com",
    imageUrl:
      "https://www.gstatic.com/marketing-cms/assets/images/08/25/fffdc76145f28be3a1ca63859c4a/external-logo-core-1.png=n-w1860-h1047-fcrop64=1,00000000ffffffff-rw",
    accentColor: "#FF0000",
  },
  {
    id: "disney",
    title: "Disney+",
    category: "media",
    url: "https://www.disneyplus.com",
    imageUrl:
      "https://lumiere-a.akamaihd.net/v1/images/disney_logo_march_2024_050fef2e.png?region=0%2C0%2C1920%2C1080",
    accentColor: "#113CCF",
  },
  {
    id: "tving",
    title: "TVING",
    category: "media",
    url: "https://www.tving.com",
    accentColor: "#FF153C",
    imageFit: "contain",
  },
  {
    id: "wavve",
    title: "Wavve",
    category: "media",
    url: "https://www.wavve.com",
    accentColor: "#004FFF",
  },
  {
    id: "watcha",
    title: "Watcha",
    category: "media",
    url: "https://watcha.com",
    accentColor: "#FF0558",
    imageFit: "contain",
  },
  {
    id: "coupang",
    title: "Coupang Play",
    category: "media",
    url: "https://www.coupangplay.com",
    accentColor: "#00AFFF",
  },
];

export const SMART_TOOLS: AppItem[] = [
  {
    id: "calendar",
    title: "Google Calendar",
    category: "tools",
    url: "https://calendar.google.com",
    accentColor: "#1A73E8",
  },
  {
    id: "radio",
    title: "Web Radio & BGM",
    category: "tools",
    url: "https://radio.garden",
    accentColor: "#8E24AA",
  },
  {
    id: "photos",
    title: "미디어 갤러리",
    category: "media",
    url: "#photos",
    accentColor: "#EC4899",
  },
  {
    id: "finder",
    title: "파일 파인더",
    category: "tools",
    url: "#finder",
    accentColor: "#3B82F6",
  },
  {
    id: "browser",
    title: "Quick Search",
    category: "tools",
    url: "https://www.google.com",
    accentColor: "#EA4335",
  },
];

export const QUICK_CONTROLS: AppItem[] = [
  {
    id: "ambient",
    title: "Ambient Display",
    category: "system",
    url: "#ambient",
    accentColor: "#6366F1",
  },
  {
    id: "remote",
    title: "Mobile Remote",
    category: "system",
    url: "#remote",
    accentColor: "#10B981",
  },
];

export const ALL_APPS = [...STREAMING_APPS, ...SMART_TOOLS, ...QUICK_CONTROLS];
