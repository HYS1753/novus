import React, { useEffect, useState } from "react";
import {
  ArrowUpIcon,
  FolderIcon,
  getSystemLocations,
  NvButton,
  NvEmptyState,
  NvListRow,
  NvListSection,
  scanDirectory,
  useI18n,
  type DirectoryScanResult,
  type QuickLocation,
} from "@/shared";

export interface FolderPickerProps {
  /** Folder to start in; `null` starts at the OS Pictures folder. */
  initialPath: string | null;
  /** Picks a folder path, or `null` for "use the default Pictures folder". */
  onPick: (path: string | null) => void;
}

// The picker can sit over the mounted home. Bound both lists independently
// so even roots with thousands of folders/drives stay inside its DOM budget.
const PAGE_SIZE = 4;

/**
 * Folder browser for the photo source. Lists only sub-folders plus the number
 * of photos in the current one, so the user knows what the home will show.
 */
export const FolderPicker: React.FC<FolderPickerProps> = ({ initialPath, onPick }) => {
  const { t } = useI18n();
  const [locations, setLocations] = useState<QuickLocation[]>([]);
  const [path, setPath] = useState<string | null>(initialPath);
  const [scan, setScan] = useState<DirectoryScanResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [folderPage, setFolderPage] = useState({ path: initialPath, offset: 0 });
  const [quickOffset, setQuickOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSystemLocations()
      .then((result) => {
        if (cancelled) return;
        setLocations(result);
        setPath(
          (current) => current ?? result.find((l) => l.category === "pictures")?.path ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    scanDirectory(path, "media")
      .then((result) => {
        if (cancelled) return;
        setScan(result);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const folders = scan?.items.filter((item) => item.is_dir) ?? [];
  const photoCount = scan?.items.filter((item) => item.media_type === "image").length ?? 0;
  const quick = locations.filter((location) =>
    ["pictures", "home", "downloads", "drive"].includes(location.category),
  );
  const folderOffset = folderPage.path === path ? folderPage.offset : 0;
  const pageControls = (offset: number, total: number, change: (offset: number) => void) =>
    total > PAGE_SIZE && (
      <div className="nv-folder-picker__actions">
        <NvButton disabled={offset === 0} onClick={() => change(Math.max(0, offset - PAGE_SIZE))}>
          {t("common.back")}
        </NvButton>
        <span aria-live="polite">{`${offset + 1}–${Math.min(total, offset + PAGE_SIZE)} / ${total}`}</span>
        <NvButton disabled={offset + PAGE_SIZE >= total} onClick={() => change(offset + PAGE_SIZE)}>
          {t("common.next")}
        </NvButton>
      </div>
    );

  return (
    <div className="nv-folder-picker">
      {scan && (
        <div className="nv-folder-picker__current">
          <span className="nv-folder-picker__path" title={scan.current_path}>
            {scan.current_path}
          </span>
          <span className="nv-folder-picker__count">
            {t("folder.photoCount", { count: photoCount })}
          </span>
          <div className="nv-folder-picker__actions">
            <NvButton variant="primary" onClick={() => onPick(scan.current_path)}>
              {t("folder.useThis")}
            </NvButton>
            {scan.parent_path && (
              <NvButton icon={<ArrowUpIcon />} onClick={() => setPath(scan.parent_path)}>
                {t("folder.up")}
              </NvButton>
            )}
          </div>
        </div>
      )}

      {failed ? (
        <NvEmptyState icon={<FolderIcon />} title={t("folder.error")} />
      ) : folders.length > 0 ? (
        <NvListSection>
          {folders.slice(folderOffset, folderOffset + PAGE_SIZE).map((folder) => (
            <NvListRow
              key={folder.path}
              icon={<FolderIcon size={20} />}
              title={folder.name}
              onPress={() => setPath(folder.path)}
            />
          ))}
          {pageControls(folderOffset, folders.length, (offset) => setFolderPage({ path, offset }))}
        </NvListSection>
      ) : (
        scan && <NvEmptyState icon={<FolderIcon />} title={t("folder.empty")} />
      )}

      {quick.length > 0 && (
        <NvListSection title={t("folder.locations")}>
          {quick.slice(quickOffset, quickOffset + PAGE_SIZE).map((location) => (
            <NvListRow
              key={location.path}
              icon={<FolderIcon size={20} />}
              title={location.name}
              description={location.path}
              onPress={() => setPath(location.path)}
            />
          ))}
          {pageControls(quickOffset, quick.length, setQuickOffset)}
        </NvListSection>
      )}

      <div className="nv-folder-picker__default">
        <NvButton variant="quiet" onClick={() => onPick(null)}>
          {t("folder.useDefault")}
        </NvButton>
      </div>
    </div>
  );
};
