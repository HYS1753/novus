import React, { useCallback, useEffect, useRef, useState } from "react";
import type { GallerySort, GalleryState, GalleryTab } from "@/features";
import {
  CloseIcon,
  FolderIcon,
  ImageIcon,
  NvSegmented,
  SearchIcon,
  SortDirectionIcon,
  useI18n,
  type QuickLocation,
} from "@/shared";

/** A small anchored menu: closes on outside press or Escape, and returns focus. */
const Menu: React.FC<{
  label: string;
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
}> = ({ label, trigger, children, align = "start" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Opening moves focus to the chosen entry (or the first); closing returns it.
  useEffect(() => {
    if (!open) return;
    const panel = ref.current?.querySelector<HTMLElement>("[role=menu]");
    (
      panel?.querySelector<HTMLElement>("[aria-checked=true]") ??
      panel?.querySelector<HTMLElement>("button")
    )?.focus();
  }, [open]);
  // Found by state, not by ref: the open menu's trigger is the expanded one.
  const close = useCallback(() => {
    const trigger = document.querySelector<HTMLElement>(
      ".gv-menu [data-menu-trigger][aria-expanded='true']",
    );
    setOpen(false);
    trigger?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        ref.current?.querySelector<HTMLElement>("[data-menu-trigger]")?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div className="gv-menu" ref={ref}>
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div className={`gv-menu__panel gv-menu__panel--${align}`} role="menu" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
};

const LOCATION_ICON: Partial<Record<QuickLocation["category"], React.ReactNode>> = {
  pictures: <ImageIcon size={18} />,
};

type Translate = ReturnType<typeof useI18n>["t"];

function orderLabels(field: GallerySort["field"], t: Translate) {
  if (field === "modified")
    return { desc: t("gallery.orderNewest"), asc: t("gallery.orderOldest") };
  if (field === "size") return { desc: t("gallery.orderLargest"), asc: t("gallery.orderSmallest") };
  return { asc: t("gallery.orderAZ"), desc: t("gallery.orderZA") };
}

export interface GalleryHeaderProps {
  state: GalleryState;
}

/**
 * One calm bar: the location as the title (press to switch), the three
 * views, then search and sort. Everything else lives where it is used.
 */
export const GalleryHeader: React.FC<GalleryHeaderProps> = ({ state }) => {
  const { t, locale } = useI18n();
  const [searching, setSearching] = useState(Boolean(state.search));
  const inputRef = useRef<HTMLInputElement>(null);
  const collection = state.tab === "folders" ? state.folderView : state.library;
  const fmt = new Intl.NumberFormat(locale);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  const media = collection.imageCount + collection.videoCount;
  const folderTotal = collection.total - media;
  const counts =
    collection.status === "ready"
      ? [
          folderTotal > 0 ? t("gallery.foldersCount", { count: fmt.format(folderTotal) }) : "",
          media > 0 || folderTotal === 0
            ? t("gallery.libraryCount", {
                images: fmt.format(collection.imageCount),
                videos: fmt.format(collection.videoCount),
              })
            : "",
          collection.truncated
            ? t("gallery.truncated", { count: fmt.format(collection.total) })
            : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "\u00a0";

  const tabs: { value: GalleryTab; label: string }[] = [
    ...(state.tv ? [{ value: "home" as const, label: t("gallery.tabHome") }] : []),
    { value: "photos", label: t("gallery.tabPhotos") },
    { value: "folders", label: t("gallery.tabFolders") },
    { value: "videos", label: t("gallery.tabVideos") },
  ];
  const orders = orderLabels(state.sort.field, t);
  const fields: { value: GallerySort["field"]; label: string }[] = [
    { value: "modified", label: t("files.sortDate") },
    { value: "name", label: t("files.sortName") },
    { value: "size", label: t("files.sortSize") },
  ];

  return (
    <header className="gv-head">
      <div className="gv-head__title">
        <Menu
          label={t("gallery.location")}
          trigger={({ open, toggle }) => (
            <button
              type="button"
              className="gv-head__location"
              aria-haspopup="menu"
              aria-expanded={open}
              data-menu-trigger
              onClick={toggle}
              title={t("gallery.location")}
            >
              <span className="gv-head__name">{state.rootLabel || t("nav.gallery")}</span>
              <span className="gv-head__chev" aria-hidden="true" />
            </button>
          )}
        >
          {(close) =>
            state.locations.map((location) => (
              <button
                key={location.path}
                type="button"
                role="menuitemradio"
                aria-checked={location.path === state.root}
                className="gv-menu__item"
                onClick={() => {
                  state.setRoot(location.path);
                  close();
                }}
              >
                <span className="gv-menu__icon" aria-hidden="true">
                  {LOCATION_ICON[location.category] ?? <FolderIcon size={18} />}
                </span>
                <span className="gv-menu__text">
                  <span>{location.name}</span>
                  <span className="gv-menu__sub">{location.path}</span>
                </span>
              </button>
            ))
          }
        </Menu>
        <span className="gv-head__counts">{counts}</span>
      </div>

      <NvSegmented
        label={t("gallery.tabs")}
        options={tabs}
        value={state.tab}
        onChange={state.setTab}
        className="gv-head__tabs"
      />

      <div className="gv-head__tools" hidden={state.tab === "home"}>
        {searching ? (
          <label className="gv-search">
            <SearchIcon size={18} />
            <input
              ref={inputRef}
              type="search"
              value={state.search}
              placeholder={t("gallery.search")}
              aria-label={t("gallery.search")}
              onChange={(event) => state.setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  state.setSearch("");
                  setSearching(false);
                }
              }}
            />
            <button
              type="button"
              className="gv-search__clear"
              aria-label={t("gallery.clearSearch")}
              title={t("gallery.clearSearch")}
              onClick={() => {
                state.setSearch("");
                setSearching(false);
              }}
            >
              <CloseIcon size={16} />
            </button>
          </label>
        ) : (
          <button
            type="button"
            className="gv-tool"
            aria-label={t("gallery.search")}
            title={t("gallery.search")}
            onClick={() => setSearching(true)}
          >
            <SearchIcon size={20} />
          </button>
        )}

        <Menu
          label={t("files.sort")}
          align="end"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              className="gv-tool gv-tool--labelled"
              aria-haspopup="menu"
              aria-expanded={open}
              data-menu-trigger
              onClick={toggle}
              title={t("files.sort")}
            >
              <SortDirectionIcon size={20} direction={state.sort.order} />
              <span>{orders[state.sort.order]}</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <span className="gv-menu__label">{t("files.sort")}</span>
              {fields.map((field) => (
                <button
                  key={field.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={state.sort.field === field.value}
                  className="gv-menu__item"
                  onClick={() =>
                    state.setSort({
                      field: field.value,
                      order: field.value === "name" ? "asc" : "desc",
                    })
                  }
                >
                  <span className="gv-menu__text">{field.label}</span>
                </button>
              ))}
              <span className="gv-menu__rule" />
              {(state.sort.field === "name"
                ? (["asc", "desc"] as const)
                : (["desc", "asc"] as const)
              ).map((order) => (
                <button
                  key={order}
                  type="button"
                  role="menuitemradio"
                  aria-checked={state.sort.order === order}
                  className="gv-menu__item"
                  onClick={() => {
                    state.setSort({ field: state.sort.field, order });
                    close();
                  }}
                >
                  <span className="gv-menu__text">{orderLabels(state.sort.field, t)[order]}</span>
                </button>
              ))}
            </>
          )}
        </Menu>
      </div>
    </header>
  );
};
