import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FileItem, QuickLocation } from "@/entities";
import type { PathBreadcrumb, SortField, SortOrder } from "@/features";
import {
  FolderIcon,
  GlassMenu,
  GlassMediaTile,
  GlassSegmentedControl,
  ImageIcon,
  MotionIcon,
  PathNavigation,
  SearchIcon,
  SortDirectionIcon,
  getImageThumbnail,
} from "@/shared";

interface GalleryGridProps {
  items: FileItem[];
  totalCount: number;
  imageCount: number;
  videoCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void;
  locations: QuickLocation[];
  breadcrumbs: PathBreadcrumb[];
  parentPath: string | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortOrder: SortOrder;
  onToggleSortOrder: () => void;
  onNavigateTo: (path: string) => void;
  onNavigateUp: () => void;
  onSelectImage: (index: number) => void;
  onSelectVideo: (item: FileItem) => void;
}

function formatBytes(bytes: number): string | undefined {
  if (bytes <= 0) return undefined;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const GalleryTile: React.FC<{ item: FileItem; onOpenItem: (item: FileItem) => void }> = React.memo(
  ({ item, onOpenItem }) => {
    const [thumbnail, setThumbnail] = useState("");

    useEffect(() => {
      const controller = new AbortController();
      let active = true;
      if (item.media_type === "image") {
        void getImageThumbnail(
          item.path,
          320,
          1,
          controller.signal,
          `${item.modified_ms}:${item.size}`,
        )
          .then((value) => {
            if (active) setThumbnail(value);
          })
          .catch(() => undefined);
      }
      return () => {
        active = false;
        controller.abort();
      };
    }, [item.media_type, item.modified_ms, item.path, item.size]);

    return (
      <GlassMediaTile
        title={item.name}
        typeLabel={item.is_dir ? "폴더" : item.extension.toUpperCase() || "파일"}
        sizeLabel={item.is_dir ? undefined : formatBytes(item.size)}
        thumbnailUrl={thumbnail || undefined}
        category={item.is_dir ? "directory" : item.media_type}
        onClick={() => onOpenItem(item)}
      />
    );
  },
);

GalleryTile.displayName = "GalleryTile";

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  items,
  totalCount,
  imageCount,
  videoCount,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  locations,
  breadcrumbs,
  parentPath,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  sortField,
  onSortFieldChange,
  sortOrder,
  onToggleSortOrder,
  onNavigateTo,
  onNavigateUp,
  onSelectImage,
  onSelectVideo,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [layout, setLayout] = useState({ columns: 1, rowHeight: 174, viewportHeight: 600 });
  const imageItems = useMemo(() => items.filter((item) => item.media_type === "image"), [items]);
  const totalRows = Math.ceil(items.length / layout.columns);
  const overscanRows = 1;
  const windowRows = Math.ceil(layout.viewportHeight / layout.rowHeight) + overscanRows * 2;
  const startRow = Math.min(
    Math.max(0, Math.floor(scrollTop / layout.rowHeight) - overscanRows),
    Math.max(0, totalRows - windowRows),
  );
  const endRow = Math.min(totalRows, startRow + windowRows);
  const visibleItems = items.slice(startRow * layout.columns, endRow * layout.columns);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const grid = gridRef.current;
    if (!viewport || !grid) return;

    const measure = () => {
      const styles = getComputedStyle(grid);
      const gap = parseFloat(styles.getPropertyValue("--gallery-grid-gap")) || 16;
      const minWidth = parseFloat(styles.getPropertyValue("--gallery-tile-min")) || 158;
      const width = grid.clientWidth;
      const columns = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
      const rowHeight = (width - gap * (columns - 1)) / columns + gap;
      setLayout((previous) => {
        const next = { columns, rowHeight, viewportHeight: viewport.clientHeight };
        return previous.columns === next.columns &&
          Math.abs(previous.rowHeight - next.rowHeight) < 0.5 &&
          previous.viewportHeight === next.viewportHeight
          ? previous
          : next;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isLoading, error, items.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setScrollTop(viewport.scrollTop);
        frame = 0;
      });
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || isLoading || isLoadingMore || loadMoreError || !hasMore) return;
    if (viewport.scrollHeight - scrollTop - viewport.clientHeight < layout.rowHeight * 3) {
      onLoadMore();
    }
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    items.length,
    layout.rowHeight,
    loadMoreError,
    onLoadMore,
    scrollTop,
  ]);

  const resetScroll = () => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    setScrollTop(0);
  };

  const handleTileClick = useCallback(
    (item: FileItem) => {
      if (item.is_dir) return onNavigateTo(item.path);
      if (item.media_type === "video") return onSelectVideo(item);
      const imageIndex = imageItems.findIndex((image) => image.path === item.path);
      if (imageIndex >= 0) onSelectImage(imageIndex);
    },
    [imageItems, onNavigateTo, onSelectImage, onSelectVideo],
  );

  return (
    <section className="gallery-browser" aria-label="미디어 갤러리">
      <div className="gallery-browser__toolbar">
        <div className="gallery-browser__navigation">
          <GlassMenu
            align="start"
            trigger={
              <button type="button" className="gallery-browser__location-trigger">
                <MotionIcon motion="pop">
                  <FolderIcon size={18} />
                </MotionIcon>
                <span>위치</span>
              </button>
            }
            items={locations.map((location) => ({
              id: location.path,
              label: location.name,
              icon: <FolderIcon size={16} />,
              onSelect: () => onNavigateTo(location.path),
            }))}
          />
          <PathNavigation
            items={breadcrumbs}
            canGoUp={Boolean(parentPath)}
            onUp={onNavigateUp}
            onNavigate={onNavigateTo}
          />
          <small className="gallery-browser__count">
            이미지 {imageCount} ∙ 동영상 {videoCount}
          </small>
        </div>

        <div className="gallery-browser__controls">
          <GlassSegmentedControl<SortField>
            value={sortField}
            onChange={(value) => {
              resetScroll();
              onSortFieldChange(value);
            }}
            options={[
              { id: "name", label: "파일명" },
              { id: "modified", label: "날짜" },
              { id: "size", label: "크기" },
            ]}
          />
          <button
            type="button"
            className="gallery-browser__sort-order"
            onClick={() => {
              resetScroll();
              onToggleSortOrder();
            }}
            aria-label={sortOrder === "asc" ? "내림차순으로 변경" : "오름차순으로 변경"}
            title="정렬 방향 변경"
          >
            <MotionIcon motion="pop">
              <SortDirectionIcon size={17} direction={sortOrder} />
            </MotionIcon>
          </button>
          <label className="gallery-browser__search">
            <SearchIcon size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                resetScroll();
                onSearchChange(event.target.value);
              }}
              placeholder="미디어 검색"
              aria-label="미디어 검색"
            />
          </label>
        </div>
      </div>

      <div className="subpage-summary">
        <strong>{breadcrumbs.at(-1)?.label || "미디어"}</strong>
        <span>{searchQuery ? `검색 결과 ${totalCount}개` : `이 폴더의 항목 ${totalCount}개`}</span>
      </div>
      <div ref={viewportRef} className="gallery-browser__viewport">
        {isLoading ? (
          <div className="subpage-state" role="status">
            <span className="subpage-state__spinner" />
            <span>미디어를 불러오는 중…</span>
          </div>
        ) : error ? (
          <div className="subpage-state" role="alert">
            <strong>폴더를 열 수 없습니다</strong>
            <span>{error}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="subpage-state">
            <ImageIcon size={42} />
            <strong>표시할 미디어가 없습니다</strong>
            <span>다른 폴더로 이동하거나 검색어를 지워보세요.</span>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="gallery-browser__grid"
            style={{
              paddingTop: startRow * layout.rowHeight,
              paddingBottom: (totalRows - endRow) * layout.rowHeight,
            }}
          >
            {visibleItems.map((item) => (
              <GalleryTile
                key={`${item.path}:${item.modified_ms}:${item.size}`}
                item={item}
                onOpenItem={handleTileClick}
              />
            ))}
          </div>
        )}
        {!isLoading && !error && loadMoreError && (
          <div className="gallery-browser__load-more" role="alert">
            <span>다음 사진을 불러오지 못했습니다.</span>
            <button type="button" onClick={onLoadMore}>
              다시 시도
            </button>
          </div>
        )}
        {!isLoading && !error && isLoadingMore && (
          <div className="gallery-browser__load-more" role="status">
            다음 사진을 불러오는 중…
          </div>
        )}
      </div>
    </section>
  );
};
