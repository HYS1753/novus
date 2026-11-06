import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PathBreadcrumb, SortField, SortOrder } from "@/features";
import {
  ArchiveIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CloseIcon,
  DocumentIcon,
  FolderIcon,
  ImageIcon,
  NvButton,
  NvEmptyState,
  NvMediaThumb,
  NvIconMotion,
  NvMenu,
  NvSegmented,
  SearchIcon,
  SortDirectionIcon,
  VideoIcon,
  locationLabel,
  useI18n,
  type FileItem,
  type QuickLocation,
} from "@/shared";
import "./files-v2.css";

export type FilesLayout = "list" | "grid";

export interface FilesV2Props {
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
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  onNavigateTo: (path: string) => void;
  onNavigateUp: () => void;
  onReload: () => void;
  /** A file (not a folder) was pressed. */
  onOpenFile: (item: FileItem) => void;
}

type Translate = ReturnType<typeof useI18n>["t"];

const LAYOUT_KEY = "novus.files.v2.layout";
/** Rows/tile rows mounted beyond the viewport, as a share of its height. */
const OVERSCAN = 0.5;
const FAVORITE_ORDER: QuickLocation["category"][] = [
  "home",
  "desktop",
  "documents",
  "downloads",
  "pictures",
  "videos",
];

function readLayout(): FilesLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function typeIcon(item: FileItem, size: number) {
  if (item.is_dir) return <FolderIcon size={size} />;
  if (item.media_type === "image") return <ImageIcon size={size} />;
  if (item.media_type === "video") return <VideoIcon size={size} />;
  if (item.media_type === "archive") return <ArchiveIcon size={size} />;
  return <DocumentIcon size={size} />;
}

function formatBytes(bytes: number, locale: string) {
  if (!bytes) return "—";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${number.format(bytes / 1024 ** index)} ${units[index]}`;
}

function orderLabels(field: SortField, t: Translate) {
  if (field === "modified")
    return { desc: t("gallery.orderNewest"), asc: t("gallery.orderOldest") };
  if (field === "size") return { desc: t("gallery.orderLargest"), asc: t("gallery.orderSmallest") };
  return { asc: t("gallery.orderAZ"), desc: t("gallery.orderZA") };
}

/** The scroller's viewport, read per frame but published only when it moves a whole row. */
function useWindow(scroller: HTMLElement | null, rowHeight: number, rows: number) {
  const [range, setRange] = useState({ first: 0, last: 0 });
  useLayoutEffect(() => {
    if (!scroller || rowHeight <= 0) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const over = scroller.clientHeight * OVERSCAN;
      const first = Math.max(0, Math.floor((scroller.scrollTop - over) / rowHeight));
      const last = Math.min(
        rows,
        Math.ceil((scroller.scrollTop + scroller.clientHeight + over) / rowHeight),
      );
      setRange((current) =>
        current.first === first && current.last === last ? current : { first, last },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [rowHeight, rows, scroller]);
  return range;
}

/**
 * Files (benchmarked on iPadOS Files and the Windows 11 tablet Explorer):
 * a quiet sidebar of favourites and drives, the folder as the title over
 * its crumb trail, search, sort, and list or icon view. Photos show their
 * thumbnails; long folders are virtualized instead of paged.
 */
export const FilesV2: React.FC<FilesV2Props> = ({
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
  sortOrder,
  onSortChange,
  onNavigateTo,
  onNavigateUp,
  onReload,
  onOpenFile,
}) => {
  const { t, locale } = useI18n();
  const [layout, setLayoutState] = useState<FilesLayout>(readLayout);
  const [searching, setSearching] = useState(Boolean(searchQuery));
  const inputRef = useRef<HTMLInputElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [probe, setProbe] = useState<HTMLSpanElement | null>(null);
  const [metrics, setMetrics] = useState({ row: 56, tile: 180, label: 56, gap: 12, width: 800 });

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  // Sizes come from CSS (posture and scale), the width from the scroller.
  useLayoutEffect(() => {
    if (!probe || !scroller) return;
    const [row, tile, label] = [...probe.children] as HTMLElement[];
    const read = () =>
      setMetrics({
        row: row?.offsetHeight || 56,
        tile: tile?.offsetWidth || 180,
        label: label?.offsetHeight || 56,
        gap: probe.offsetWidth || 12,
        width: scroller.clientWidth - parseFloat(getComputedStyle(scroller).paddingLeft) * 2,
      });
    const observer = new ResizeObserver(read);
    observer.observe(probe);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [probe, scroller]);

  const setLayout = (next: FilesLayout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // The choice still holds for this visit.
    }
  };

  // Grid: as many columns as fit at the minimum tile width.
  const columns = Math.max(
    1,
    Math.floor((metrics.width + metrics.gap) / (metrics.tile + metrics.gap)),
  );
  const tileWidth = (metrics.width - metrics.gap * (columns - 1)) / columns;
  const gridRow = tileWidth * 0.75 + metrics.label + metrics.gap;
  const rowHeight = layout === "list" ? metrics.row : gridRow;
  const rowCount = layout === "list" ? items.length : Math.ceil(items.length / columns);
  const range = useWindow(scroller, rowHeight, rowCount);

  const folderCount = useMemo(() => items.filter((item) => item.is_dir).length, [items]);
  const fmt = new Intl.NumberFormat(locale);
  const counts = searchQuery
    ? t("files.searchResults", { count: fmt.format(items.length) })
    : t("finder.counts", {
        folders: fmt.format(folderCount),
        files: fmt.format(items.length - folderCount),
      });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const favorites = FAVORITE_ORDER.flatMap((category) =>
    locations.filter((location) => location.category === category),
  );
  const drives = locations.filter((location) => location.category === "drive");
  // The sidebar marks the deepest location the current folder sits in.
  const activeLocation = [...locations]
    .filter((location) => currentPath === location.path || currentPath.startsWith(location.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  const locationName = (path: string) => {
    const match = locations.find((location) => location.path === path);
    return match ? locationLabel(t, match) : undefined;
  };
  const title = locationName(currentPath) ?? breadcrumbs.at(-1)?.label ?? t("nav.files");

  const open = (item: FileItem) => {
    if (item.is_dir) onNavigateTo(item.path);
    else onOpenFile(item);
  };
  const typeLabel = (item: FileItem) =>
    item.is_dir ? t("files.folder") : item.extension.toUpperCase() || t("files.file");

  const orders = orderLabels(sortField, t);
  const fields: { value: SortField; label: string }[] = [
    { value: "name", label: t("files.sortName") },
    { value: "modified", label: t("files.sortDate") },
    { value: "size", label: t("files.sortSize") },
  ];

  const renderList = () => (
    <div
      className="fs-list"
      role="list"
      aria-label={t("finder.table")}
      style={{ height: items.length * metrics.row }}
    >
      {items.slice(range.first, range.last).map((item, offset) => {
        const index = range.first + offset;
        return (
          <button
            key={item.path}
            type="button"
            role="listitem"
            className="fs-row"
            data-nav-default={index === 0 || undefined}
            style={{ transform: `translate3d(0, ${index * metrics.row}px, 0)` }}
            onClick={() => open(item)}
          >
            <span className="fs-row__icon" data-kind={item.is_dir ? "folder" : item.media_type}>
              {item.media_type === "image" ? (
                <NvMediaThumb item={item} size={48} />
              ) : (
                typeIcon(item, 20)
              )}
            </span>
            <span className="fs-row__name">{item.name}</span>
            <span className="fs-row__type">{typeLabel(item)}</span>
            <span className="fs-row__size">
              {item.is_dir ? "—" : formatBytes(item.size, locale)}
            </span>
            <span className="fs-row__date">
              {item.modified_ms ? dateFmt.format(item.modified_ms) : "—"}
            </span>
            {item.is_dir && (
              <span className="fs-row__chev" aria-hidden="true">
                <ChevronRightIcon size={18} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderGrid = () => (
    <div className="fs-grid" role="list" style={{ height: rowCount * gridRow }}>
      {items.slice(range.first * columns, range.last * columns).map((item, offset) => {
        const index = range.first * columns + offset;
        const row = Math.floor(index / columns);
        const column = index % columns;
        return (
          <button
            key={item.path}
            type="button"
            role="listitem"
            className="fs-tile"
            data-nav-default={index === 0 || undefined}
            style={{
              width: tileWidth,
              transform: `translate3d(${column * (tileWidth + metrics.gap)}px, ${row * gridRow}px, 0)`,
            }}
            onClick={() => open(item)}
          >
            <span className="fs-tile__face" data-kind={item.is_dir ? "folder" : item.media_type}>
              {item.media_type === "image" ? (
                <NvMediaThumb item={item} size={tileWidth} />
              ) : (
                <>
                  {typeIcon(item, 36)}
                  {!item.is_dir && item.extension && (
                    <span className="fs-tile__ext">{item.extension.toUpperCase()}</span>
                  )}
                </>
              )}
            </span>
            <span className="fs-tile__name">{item.name}</span>
            <span className="fs-tile__meta">
              {item.is_dir ? t("files.folder") : formatBytes(item.size, locale)}
            </span>
          </button>
        );
      })}
    </div>
  );

  const sidebarRow = (location: QuickLocation) => (
    <button
      key={location.path}
      type="button"
      className="fs-side__item"
      aria-current={activeLocation === location.path ? "location" : undefined}
      onClick={() => onNavigateTo(location.path)}
    >
      <span className="fs-side__icon" aria-hidden="true">
        {location.category === "pictures" ? (
          <ImageIcon size={18} />
        ) : location.category === "videos" ? (
          <VideoIcon size={18} />
        ) : (
          <FolderIcon size={18} />
        )}
      </span>
      <span className="fs-side__name">{locationLabel(t, location)}</span>
    </button>
  );

  return (
    <section className="fs" aria-label={t("nav.files")}>
      <span ref={setProbe} className="fs__probe" aria-hidden="true">
        <span className="fs__probe-row" />
        <span className="fs__probe-tile" />
        <span className="fs__probe-label" />
      </span>

      <aside className="fs-side" aria-label={t("files.quickLocations")}>
        {favorites.length > 0 && (
          <>
            <span className="fs-side__label">{t("files.favorites")}</span>
            {favorites.map(sidebarRow)}
          </>
        )}
        {drives.length > 0 && (
          <>
            <span className="fs-side__label">{t("files.drives")}</span>
            {drives.map(sidebarRow)}
          </>
        )}
      </aside>

      <div className="fs-main">
        <header className="fs-head">
          <div className="fs-head__title">
            <button
              type="button"
              className="fs-tool"
              onClick={onNavigateUp}
              disabled={!parentPath}
              aria-label={t("files.up")}
              title={t("files.up")}
            >
              <NvIconMotion>
                <ArrowUpIcon size={20} />
              </NvIconMotion>
            </button>
            <div className="fs-head__text">
              <h2 className="fs-head__name" title={currentPath}>
                {title}
              </h2>
              <span className="fs-head__counts">{isLoading ? " " : counts}</span>
            </div>
          </div>

          <div className="fs-head__tools">
            {searching ? (
              <label className="fs-search">
                <SearchIcon size={18} />
                <input
                  ref={inputRef}
                  type="search"
                  value={searchQuery}
                  placeholder={t("finder.search")}
                  aria-label={t("finder.search")}
                  onChange={(event) => onSearchChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      onSearchChange("");
                      setSearching(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="fs-search__clear"
                  aria-label={t("gallery.clearSearch")}
                  title={t("gallery.clearSearch")}
                  onClick={() => {
                    onSearchChange("");
                    setSearching(false);
                  }}
                >
                  <NvIconMotion>
                    <CloseIcon size={16} />
                  </NvIconMotion>
                </button>
              </label>
            ) : (
              <button
                type="button"
                className="fs-tool"
                aria-label={t("finder.search")}
                title={t("finder.search")}
                onClick={() => setSearching(true)}
              >
                <NvIconMotion>
                  <SearchIcon size={20} />
                </NvIconMotion>
              </button>
            )}

            <NvMenu
              label={t("files.sort")}
              align="end"
              trigger={({ open: isOpen, toggle }) => (
                <button
                  type="button"
                  className="fs-tool fs-tool--labelled"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  data-menu-trigger
                  onClick={toggle}
                  title={t("files.sort")}
                >
                  <SortDirectionIcon size={20} direction={sortOrder} />
                  <span>{orders[sortOrder]}</span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <span className="nv-menu__label">{t("files.sort")}</span>
                  {fields.map((field) => (
                    <button
                      key={field.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortField === field.value}
                      className="nv-menu__item"
                      onClick={() =>
                        onSortChange(field.value, field.value === "name" ? "asc" : "desc")
                      }
                    >
                      <span className="nv-menu__text">{field.label}</span>
                    </button>
                  ))}
                  <span className="nv-menu__rule" />
                  {(sortField === "name"
                    ? (["asc", "desc"] as const)
                    : (["desc", "asc"] as const)
                  ).map((order) => (
                    <button
                      key={order}
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortOrder === order}
                      className="nv-menu__item"
                      onClick={() => {
                        onSortChange(sortField, order);
                        close();
                      }}
                    >
                      <span className="nv-menu__text">{orders[order]}</span>
                    </button>
                  ))}
                </>
              )}
            </NvMenu>

            <NvSegmented
              label={t("finder.view")}
              value={layout}
              options={[
                { value: "list", label: t("finder.listShort") },
                { value: "grid", label: t("finder.iconShort") },
              ]}
              onChange={setLayout}
            />
          </div>
        </header>

        {breadcrumbs.length > 1 && (
          <nav className="fs-crumbs" aria-label={t("files.location")}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && (
                  <span className="fs-crumbs__sep" aria-hidden="true">
                    <ChevronRightIcon size={14} />
                  </span>
                )}
                <button
                  type="button"
                  className="fs-crumbs__item"
                  aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}
                  onClick={() => onNavigateTo(crumb.path)}
                >
                  {locationName(crumb.path) ?? crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {layout === "list" && items.length > 0 && !isLoading && !error && (
          <div className="fs-columns" aria-hidden="true">
            <span />
            <span>{t("finder.colName")}</span>
            <span>{t("finder.colType")}</span>
            <span>{t("finder.colSize")}</span>
            <span>{t("finder.colModified")}</span>
          </div>
        )}

        <div ref={setScroller} className="fs-body" data-layout={layout}>
          {isLoading ? (
            <div className="fs-skeleton" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          ) : error ? (
            <NvEmptyState
              icon={<FolderIcon size={28} />}
              title={t("files.loadError")}
              body={t("files.loadErrorHint")}
              action={<NvButton onClick={onReload}>{t("common.retry")}</NvButton>}
            />
          ) : items.length === 0 ? (
            <NvEmptyState
              icon={<FolderIcon size={28} />}
              title={searchQuery ? t("finder.noResults") : t("finder.empty")}
              body={searchQuery ? t("finder.noResultsHint") : t("finder.emptyHint")}
              action={
                searchQuery ? (
                  <NvButton onClick={() => onSearchChange("")}>{t("gallery.clearSearch")}</NvButton>
                ) : undefined
              }
            />
          ) : layout === "list" ? (
            renderList()
          ) : (
            renderGrid()
          )}
        </div>
      </div>
    </section>
  );
};
