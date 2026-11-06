import React, { useEffect, useState } from "react";
import { getImageThumbnail, PlayIcon, type FileItem } from "@/shared";

export interface MediaThumbProps {
  item: FileItem | undefined;
  /** Rendered size in CSS px; the request is rounded to two cache sizes. */
  size: number;
}

/** Two thumbnail sizes only, so the disk cache is shared across densities. */
function thumbDim(size: number): number {
  const pixels = size * (window.devicePixelRatio || 1);
  return pixels <= 360 ? 320 : 640;
}

/**
 * One tile's picture. Fades in once decoded; until then the tile shows its
 * resting surface, so nothing flashes or reflows. Videos have no frame
 * thumbnail on this platform, so they show a quiet play mark.
 */
export const MediaThumb: React.FC<MediaThumbProps> = React.memo(({ item, size }) => {
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const dim = thumbDim(size);
  const path = item?.path;
  const isImage = item?.media_type === "image";
  const version = item ? `${item.modified_ms}:${item.size}` : "";

  useEffect(() => {
    if (!path || !isImage) return;
    const controller = new AbortController();
    let alive = true;
    void getImageThumbnail(path, dim, 1, controller.signal, version)
      .then((value) => {
        if (alive) setUrl(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      controller.abort();
    };
  }, [dim, isImage, path, version]);

  if (item?.media_type === "video") {
    return (
      <span className="gv-thumb gv-thumb--video" aria-hidden="true">
        <span className="gv-thumb__play">
          <PlayIcon size={18} />
        </span>
        <span className="gv-thumb__ext">{item.extension.toUpperCase()}</span>
      </span>
    );
  }

  return (
    <span className="gv-thumb" aria-hidden="true">
      {url && (
        <img
          className="gv-thumb__img"
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          data-loaded={loaded || undefined}
          onLoad={() => setLoaded(true)}
        />
      )}
    </span>
  );
});

MediaThumb.displayName = "MediaThumb";
