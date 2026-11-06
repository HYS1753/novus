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
          {folders.map((folder) => (
            <NvListRow
              key={folder.path}
              icon={<FolderIcon size={20} />}
              title={folder.name}
              onPress={() => setPath(folder.path)}
            />
          ))}
        </NvListSection>
      ) : (
        scan && <NvEmptyState icon={<FolderIcon />} title={t("folder.empty")} />
      )}

      {quick.length > 0 && (
        <NvListSection title={t("folder.locations")}>
          {quick.map((location) => (
            <NvListRow
              key={location.path}
              icon={<FolderIcon size={20} />}
              title={location.name}
              description={location.path}
              onPress={() => setPath(location.path)}
            />
          ))}
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
