/**
 * Local brand assets registry.
 * Vite automatically bundles all image assets dropped into `src/assets/brands/`.
 * Supports png, svg, jpg, jpeg, webp (both lower and upper case extensions).
 */
const bundledBrandAssets = import.meta.glob<string>(
  "/src/assets/brands/*.{png,PNG,jpg,JPG,jpeg,JPEG,svg,SVG,webp,WEBP}",
  { eager: true, import: "default" },
);

const BRAND_ALIASES: Record<string, string[]> = {
  disney: ["disney", "disneyplus", "disney-plus", "disney+"],
  disneyplus: ["disneyplus", "disney", "disney-plus", "disney+"],
  coupang: ["coupang", "coupangplay", "coupang-play"],
  coupangplay: ["coupangplay", "coupang", "coupang-play"],
  youtube: ["youtube", "yt"],
  netflix: ["netflix"],
  tving: ["tving"],
  wavve: ["wavve", "wave"],
  watcha: ["watcha"],
};

/**
 * Resolves the bundled local asset URL for a given brand/app ID.
 * Matches filenames in `src/assets/brands/[id].*` (case-insensitive and alias-aware).
 */
export const getBundledBrandAssetUrl = (id: string): string | undefined => {
  if (!id) return undefined;
  const targetId = id.trim().toLowerCase();
  const candidateIds = BRAND_ALIASES[targetId] || [targetId];

  for (const path in bundledBrandAssets) {
    const filename = path.split("/").pop()?.split(".")[0]?.toLowerCase();
    if (filename && candidateIds.includes(filename)) {
      return bundledBrandAssets[path];
    }
  }

  return undefined;
};
