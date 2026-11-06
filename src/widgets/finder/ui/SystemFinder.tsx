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
  useI18n,
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
  const { t } = useI18n();
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
      setMessage(t("finder.opened", { name: item.name }));
    } catch (error) {
      setMessage(t("finder.openFailed", { error: String(error) }));
    }
  };

  return (
    <section className="finder" aria-label={t("finder.title")}>
      <aside className="finder__sidebar">
        <span className="finder__eyebrow">{t("files.location")}</span>
        <nav className="finder__locations" aria-label={t("files.quickLocations")}>
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
              placeholder={t("finder.search")}
              aria-label={t("finder.search")}
            />
          </label>
          <div className="finder__sort" aria-label={t("files.sort")}>
            <GlassSegmentedControl<SortField>
              value={sortField}
              onChange={(field) => {
                setPage(0);
                onSortFieldChange(field);
              }}
              options={[
                { id: "name", label: t("files.sortName") },
                { id: "modified", label: t("files.sortDate") },
                { id: "size", label: t("files.sortSize") },
              ]}
            />
            <button
              type="button"
              className="gallery-browser__sort-order"
              onClick={onToggleSortOrder}
              aria-label={sortOrder === "asc" ? t("files.sortDesc") : t("files.sortAsc")}
              title={t("files.sortToggle")}
            >
              <SortDirectionIcon size={17} direction={sortOrder} />
            </button>
          </div>
          <div className="finder__layout" aria-label={t("finder.view")}>
            <button
              type="button"
              className={
                layout === "list"
                  ? "finder__layout-button finder__layout-button--active"
                  : "finder__layout-button"
              }
              onClick={() => setLayout("list")}
              aria-label={t("finder.listView")}
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
              aria-label={t("finder.gridView")}
            >
              <MotionIcon motion="pop">
                <GridIcon size={17} />
              </MotionIcon>
            </button>
          </div>
        </div>

        <div className="subpage-summary finder__summary">
          <strong title={currentPath}>{breadcrumbs.at(-1)?.label || t("files.file")}</strong>
          <span>
            {searchQuery
              ? t("files.searchResults", { count: items.length })
              : t("finder.counts", { folders: folderCount, files: items.length - folderCount })}
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
              <span>{t("finder.loading")}</span>
            </div>
          ) : error ? (
            <div className="subpage-state" role="alert">
              <strong>{t("files.loadError")}</strong>
              <span title={error}>{t("files.loadErrorHint")}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="subpage-state">
              <FolderIcon size={42} />
              <strong>{searchQuery ? t("finder.noResults") : t("finder.empty")}</strong>
              <span>{searchQuery ? t("finder.noResultsHint") : t("finder.emptyHint")}</span>
            </div>
          ) : layout === "grid" ? (
            <div className="finder__grid">
              {visibleItems.map((item) => (
                <GlassMediaTile
                  key={item.path}
                  title={item.name}
                  typeLabel={
                    item.is_dir
                      ? t("files.folder")
                      : item.extension.toUpperCase() || t("files.file")
                  }
                  sizeLabel={item.is_dir ? undefined : formatBytes(item.size)}
                  category={item.is_dir ? "directory" : item.media_type}
                  onClick={() => void openItem(item)}
                />
              ))}
            </div>
          ) : (
            <div className="finder-list" role="table" aria-label={t("finder.table")}>
              <div className="finder-list__row finder-list__row--header" role="row">
                <span>{t("files.sortName")}</span>
                <span>{t("finder.colType")}</span>
                <span>{t("files.sortSize")}</span>
                <span>{t("finder.colModified")}</span>
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
                  <span>
                    {item.is_dir
                      ? t("files.folder")
                      : item.extension.toUpperCase() || t("files.file")}
                  </span>
                  <span>{item.is_dir ? "—" : formatBytes(item.size)}</span>
                  <span>{formatDate(item.modified_ms)}</span>
                </button>
              ))}
            </div>
          )}
          {!isLoading && pageCount > 1 && (
            <nav className="subpage-pagination" aria-label={t("finder.pages")}>
              <button
                type="button"
                onClick={() => setPage((value) => value - 1)}
                disabled={safePage === 0}
              >
                {t("common.previous")}
              </button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => value + 1)}
                disabled={safePage === pageCount - 1}
              >
                {t("common.next")}
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
};
