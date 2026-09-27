import React, { useEffect, useState } from "react";
import type { FileItem, QuickLocation } from "@/entities";
import type { PathBreadcrumb, SortField, SortOrder } from "@/features";
import {
  ArchiveIcon,
  DocumentIcon,
  ExternalLinkIcon,
  FolderIcon,
  GlassMediaTile,
  GlassSegmentedControl,
  GridIcon,
  ImageIcon,
  ListIcon,
  MotionIcon,
  PathNavigation,
  SearchIcon,
  SortDirectionIcon,
  VideoIcon,
  openFileInOs,
} from "@/shared";

interface SystemFinderProps {
  locations: QuickLocation[];
  currentPath: string;
  parentPath: string | null;
  breadcrumbs: PathBreadcrumb[];
  items: FileItem[];
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
}

function fileIcon(item: FileItem) {
  if (item.is_dir) return <FolderIcon size={22} />;
  if (item.media_type === "archive") return <ArchiveIcon size={20} />;
  if (item.media_type === "image") return <ImageIcon size={20} />;
  if (item.media_type === "video") return <VideoIcon size={20} />;
  return <DocumentIcon size={20} />;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(milliseconds: number) {
  if (!milliseconds) return "—";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(milliseconds);
}

export const SystemFinder: React.FC<SystemFinderProps> = ({
  locations,
  currentPath,
  parentPath,
  breadcrumbs,
  items,
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
}) => {
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 40;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const folderCount = items.filter((item) => item.is_dir).length;

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const openItem = async (item: FileItem) => {
    if (item.is_dir) {
      setPage(0);
      return onNavigateTo(item.path);
    }
    try {
      await openFileInOs(item.path);
      setMessage(`“${item.name}”을(를) 열었습니다.`);
    } catch (error) {
      setMessage(`파일을 열지 못했습니다: ${String(error)}`);
    }
  };

  return (
    <section className="finder" aria-label="파일 파인더">
      <aside className="finder__sidebar">
        <span className="finder__eyebrow">위치</span>
        <nav className="finder__locations" aria-label="빠른 위치">
          {locations.map((location) => {
            const selected = currentPath === location.path;
            return (
              <button
                type="button"
                key={location.path}
                className={
                  selected ? "finder__location finder__location--active" : "finder__location"
                }
                onClick={() => {
                  setPage(0);
                  onNavigateTo(location.path);
                }}
                aria-current={selected ? "page" : undefined}
              >
                <MotionIcon motion="nudge-right">
                  <FolderIcon size={18} />
                </MotionIcon>
                <span>{location.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="finder__main">
        <div className="finder__toolbar">
          <PathNavigation
            items={breadcrumbs}
            canGoUp={Boolean(parentPath)}
            onUp={onNavigateUp}
            onNavigate={onNavigateTo}
          />
          <label className="finder__search">
            <SearchIcon size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setPage(0);
                onSearchChange(event.target.value);
              }}
              placeholder="파일 검색"
              aria-label="파일 검색"
            />
          </label>
          <div className="finder__sort" aria-label="정렬 방식">
            <GlassSegmentedControl<SortField>
              value={sortField}
              onChange={(field) => {
                setPage(0);
                onSortFieldChange(field);
              }}
              options={[
                { id: "name", label: "이름" },
                { id: "modified", label: "날짜" },
                { id: "size", label: "크기" },
              ]}
            />
            <button
              type="button"
              className="gallery-browser__sort-order"
              onClick={onToggleSortOrder}
              aria-label={sortOrder === "asc" ? "내림차순으로 변경" : "오름차순으로 변경"}
              title="정렬 방향 변경"
            >
              <SortDirectionIcon size={17} direction={sortOrder} />
            </button>
          </div>
          <div className="finder__layout" aria-label="보기 방식">
            <button
              type="button"
              className={
                layout === "list"
                  ? "finder__layout-button finder__layout-button--active"
                  : "finder__layout-button"
              }
              onClick={() => setLayout("list")}
              aria-label="목록 보기"
            >
              <MotionIcon motion="pop">
                <ListIcon size={17} />
              </MotionIcon>
            </button>
            <button
              type="button"
              className={
                layout === "grid"
                  ? "finder__layout-button finder__layout-button--active"
                  : "finder__layout-button"
              }
              onClick={() => setLayout("grid")}
              aria-label="격자 보기"
            >
              <MotionIcon motion="pop">
                <GridIcon size={17} />
              </MotionIcon>
            </button>
          </div>
        </div>

        <div className="subpage-summary finder__summary">
          <strong title={currentPath}>{breadcrumbs.at(-1)?.label || "파일"}</strong>
          <span>
            {searchQuery
              ? `검색 결과 ${items.length}개`
              : `폴더 ${folderCount}개 · 파일 ${items.length - folderCount}개`}
          </span>
        </div>

        {message && (
          <div className="finder__toast" role="status">
            <ExternalLinkIcon size={16} />
            <span>{message}</span>
          </div>
        )}

        <div className="finder__viewport">
          {isLoading ? (
            <div className="subpage-state" role="status">
              <span className="subpage-state__spinner" />
              <span>폴더를 불러오는 중…</span>
            </div>
          ) : error ? (
            <div className="subpage-state" role="alert">
              <strong>폴더를 열 수 없습니다</strong>
              <span>{error}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="subpage-state">
              <FolderIcon size={42} />
              <strong>{searchQuery ? "검색 결과가 없습니다" : "폴더가 비어 있습니다"}</strong>
              <span>
                {searchQuery ? "다른 검색어를 입력해 보세요." : "다른 위치를 선택해 보세요."}
              </span>
            </div>
          ) : layout === "grid" ? (
            <div className="finder__grid">
              {visibleItems.map((item) => (
                <GlassMediaTile
                  key={item.path}
                  title={item.name}
                  typeLabel={item.is_dir ? "폴더" : item.extension.toUpperCase() || "파일"}
                  sizeLabel={item.is_dir ? undefined : formatBytes(item.size)}
                  category={item.is_dir ? "directory" : item.media_type}
                  onClick={() => void openItem(item)}
                />
              ))}
            </div>
          ) : (
            <div className="finder-list" role="table" aria-label="파일 목록">
              <div className="finder-list__row finder-list__row--header" role="row">
                <span>이름</span>
                <span>유형</span>
                <span>크기</span>
                <span>수정일</span>
              </div>
              {visibleItems.map((item) => (
                <button
                  type="button"
                  key={item.path}
                  className="finder-list__row finder-list__item"
                  onClick={() => void openItem(item)}
                  role="row"
                >
                  <span className="finder-list__name">
                    <MotionIcon motion="nudge-right">{fileIcon(item)}</MotionIcon>
                    <strong>{item.name}</strong>
                  </span>
                  <span>{item.is_dir ? "폴더" : item.extension.toUpperCase() || "파일"}</span>
                  <span>{item.is_dir ? "—" : formatBytes(item.size)}</span>
                  <span>{formatDate(item.modified_ms)}</span>
                </button>
              ))}
            </div>
          )}
          {!isLoading && pageCount > 1 && (
            <nav className="subpage-pagination" aria-label="파일 목록 페이지">
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
      </div>
    </section>
  );
};
