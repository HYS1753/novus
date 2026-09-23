import React, { useEffect, useMemo, useState } from "react";
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
  locations: QuickLocation[];
  breadcrumbs: PathBreadcrumb[];
  parentPath: string | null;
  isLoading: boolean;
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

const GalleryTile: React.FC<{ item: FileItem; onClick: () => void }> = React.memo(
  ({ item, onClick }) => {
    const [thumbnail, setThumbnail] = useState("");

    useEffect(() => {
      let active = true;
      if (item.media_type === "image") {
        void getImageThumbnail(item.path, 320)
          .then((value) => {
            if (active) setThumbnail(value);
          })
          .catch(() => undefined);
      }
      return () => {
        active = false;
      };
    }, [item.media_type, item.path]);

    return (
      <GlassMediaTile
        title={item.name}
        typeLabel={item.is_dir ? "폴더" : item.extension.toUpperCase() || "파일"}
        sizeLabel={item.is_dir ? undefined : formatBytes(item.size)}
        thumbnailUrl={thumbnail || undefined}
        category={item.is_dir ? "directory" : item.media_type}
        onClick={onClick}
      />
    );
  },
);

GalleryTile.displayName = "GalleryTile";

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  items,
  locations,
  breadcrumbs,
  parentPath,
  isLoading,
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
  const [page, setPage] = useState(0);
  const pageSize = 60;
  const imageItems = useMemo(() => items.filter((item) => item.media_type === "image"), [items]);
  const videoCount = items.filter((item) => item.media_type === "video").length;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleTileClick = (item: FileItem) => {
    if (item.is_dir) return onNavigateTo(item.path);
    if (item.media_type === "video") return onSelectVideo(item);
    const imageIndex = imageItems.findIndex((image) => image.path === item.path);
    if (imageIndex >= 0) onSelectImage(imageIndex);
  };

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
            이미지 {imageItems.length} ∙ 동영상 {videoCount}
          </small>
        </div>

        <div className="gallery-browser__controls">
          <GlassSegmentedControl<SortField>
            value={sortField}
            onChange={(value) => {
              setPage(0);
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
              setPage(0);
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
                setPage(0);
                onSearchChange(event.target.value);
              }}
              placeholder="미디어 검색"
              aria-label="미디어 검색"
            />
          </label>
        </div>
      </div>

      <div className="gallery-browser__viewport">
        {isLoading ? (
          <div className="subpage-state" role="status">
            <span className="subpage-state__spinner" />
            <span>미디어를 불러오는 중…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="subpage-state">
            <ImageIcon size={42} />
            <strong>표시할 미디어가 없습니다</strong>
            <span>다른 폴더로 이동하거나 검색어를 지워보세요.</span>
          </div>
        ) : (
          <div className="gallery-browser__grid">
            {visibleItems.map((item) => (
              <GalleryTile key={item.path} item={item} onClick={() => handleTileClick(item)} />
            ))}
          </div>
        )}
        {!isLoading && pageCount > 1 && (
          <nav className="subpage-pagination" aria-label="갤러리 페이지">
            <button
              type="button"
              onClick={() => setPage((value) => value - 1)}
              disabled={safePage === 0}
            >
              이전
            </button>
            <span>
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={safePage === pageCount - 1}
            >
              다음
            </button>
          </nav>
        )}
      </div>
    </section>
  );
};
