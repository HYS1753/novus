import { useEffect, useRef, useState } from "react";
import {
  getAmbientArtworkForDay,
  getImageThumbnail,
  getMediaPage,
  getSystemLocations,
  usePreference,
} from "@/shared";

/** Long edge of the home photo; matches the viewer's default decode size. */
const PHOTO_DIM = 1600;
/** How many recent photos to rotate through. */
const POOL_SIZE = 40;

export interface AmbientPhoto {
  url: string;
  /** True when the user's folder had no usable photo and bundled art is shown. */
  bundled: boolean;
}

async function resolveFolder(stored: string | null): Promise<string | null> {
  if (stored) return stored;
  const locations = await getSystemLocations();
  return locations.find((location) => location.category === "pictures")?.path ?? null;
}

/**
 * The photo behind the home frame. Draws from the chosen folder (OS Pictures
 * by default), newest first, and advances every `rotateMs` (≥ 60 s). Falls
 * back to bundled artwork whenever the folder is missing, empty, or unreadable.
 */
export function useAmbientPhoto(rotateMs: number): AmbientPhoto {
  const [folder] = usePreference("ambientFolder");
  const fallback = getAmbientArtworkForDay();
  const [photo, setPhoto] = useState<AmbientPhoto>({ url: fallback?.url ?? "", bundled: true });
  const poolRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;

    const show = async () => {
      const pool = poolRef.current;
      if (pool.length === 0) return;
      const path = pool[indexRef.current % pool.length];
      indexRef.current += 1;
      try {
        const url = await getImageThumbnail(path, PHOTO_DIM, 1, controller.signal);
        if (!controller.signal.aborted) setPhoto({ url, bundled: false });
      } catch {
        // Skip an unreadable file; the next tick tries the next one.
      }
    };

    const start = async () => {
      try {
        const path = await resolveFolder(folder);
        if (!path) throw new Error("no folder");
        const page = await getMediaPage({
          path,
          searchQuery: "",
          sortField: "modified",
          sortOrder: "desc",
          pageSize: POOL_SIZE,
        });
        poolRef.current = page.items
          .filter((item) => item.media_type === "image")
          .map((item) => item.path);
      } catch {
        poolRef.current = [];
      }
      if (controller.signal.aborted) return;
      if (poolRef.current.length === 0) {
        const art = getAmbientArtworkForDay();
        setPhoto({ url: art?.url ?? "", bundled: true });
        return;
      }
      indexRef.current = 0;
      await show();
      const tick = () => {
        void show();
        timer = window.setTimeout(tick, Math.max(60_000, rotateMs));
      };
      timer = window.setTimeout(tick, Math.max(60_000, rotateMs));
    };

    void start();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [folder, rotateMs]);

  return photo;
}
