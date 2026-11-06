use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct QuickLocation {
    pub name: String,
    pub path: String,
    pub category: String, // "drive" | "home" | "pictures" | "videos" | "downloads" | "documents" | "desktop"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub extension: String,
    pub media_type: String, // "directory" | "image" | "video" | "audio" | "document" | "archive" | "other"
    /// Displayed size of an image (EXIF orientation applied). Filled per page by
    /// `get_media_page`; absent for folders, videos, and formats without a readable header.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryScanResult {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub items: Vec<FileItem>,
}

#[derive(Debug, Serialize)]
pub struct MediaPageResult {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub snapshot_id: u64,
    pub total_count: usize,
    pub image_count: usize,
    pub video_count: usize,
    pub items: Vec<FileItem>,
    pub has_more: bool,
    /// The recursive scan stopped at its file limit; the library is larger than shown.
    pub truncated: bool,
}

struct MediaSnapshot {
    id: u64,
    current_path: String,
    parent_path: Option<String>,
    items: Vec<FileItem>,
    image_count: usize,
    video_count: usize,
    truncated: bool,
}

/// One run of consecutive snapshot items in the same calendar month (local time).
#[derive(Debug, Serialize, PartialEq)]
pub struct TimelineBucket {
    pub year: i32,
    pub month: u32,
    pub count: usize,
    /// Snapshot index of the run's first item, for jumping with `offset`.
    pub first_index: usize,
}

/// The timeline scan never walks more than this many media files or this deep.
const RECURSIVE_FILE_LIMIT: usize = 20_000;
const RECURSIVE_DEPTH_LIMIT: usize = 8;
/// Folders that never hold a user's photos and are slow or protected to walk.
const SKIPPED_DIRS: &[&str] = &[
    "$recycle.bin",
    "system volume information",
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "appdata",
    "node_modules",
    "library",
];

#[derive(Default)]
pub struct MediaPageState {
    inner: Mutex<(u64, Option<MediaSnapshot>)>,
}

fn media_page(snapshot: &MediaSnapshot, offset: usize, page_size: usize) -> MediaPageResult {
    let end = offset
        .saturating_add(page_size.clamp(1, 120))
        .min(snapshot.items.len());
    MediaPageResult {
        current_path: snapshot.current_path.clone(),
        parent_path: snapshot.parent_path.clone(),
        snapshot_id: snapshot.id,
        total_count: snapshot.items.len(),
        image_count: snapshot.image_count,
        video_count: snapshot.video_count,
        items: snapshot.items.get(offset..end).unwrap_or_default().to_vec(),
        has_more: end < snapshot.items.len(),
        truncated: snapshot.truncated,
    }
}

/// Reads image headers for one page, outside the snapshot lock.
fn fill_dimensions(items: &mut [FileItem]) {
    for item in items.iter_mut().filter(|item| item.media_type == "image") {
        if let Some((width, height)) = super::image_meta::oriented_dimensions(&item.path) {
            item.width = Some(width);
            item.height = Some(height);
        }
    }
}

/// Days since 1970-01-01 → (year, month), proleptic Gregorian (Hinnant's algorithm).
fn civil_year_month(days: i64) -> (i32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = (yoe + era * 400 + if month <= 2 { 1 } else { 0 }) as i32;
    (year, month)
}

fn timeline_buckets(items: &[FileItem], utc_offset_minutes: i32) -> Vec<TimelineBucket> {
    let mut buckets: Vec<TimelineBucket> = Vec::new();
    for (index, item) in items.iter().enumerate() {
        if item.is_dir {
            continue;
        }
        let local_ms = item.modified_ms as i64 + utc_offset_minutes as i64 * 60_000;
        let (year, month) = civil_year_month(local_ms.div_euclid(86_400_000));
        match buckets.last_mut() {
            Some(last) if last.year == year && last.month == month => last.count += 1,
            _ => buckets.push(TimelineBucket {
                year,
                month,
                count: 1,
                first_index: index,
            }),
        }
    }
    buckets
}

/// Month runs of the current snapshot, for the gallery's date scrubber.
/// `utc_offset_minutes` is the local offset east of UTC (KST = 540).
#[tauri::command]
pub fn get_media_timeline(
    app: tauri::AppHandle,
    snapshot_id: u64,
    utc_offset_minutes: i32,
) -> Result<Vec<TimelineBucket>, String> {
    let state = app.state::<MediaPageState>();
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let snapshot = guard.1.as_ref().ok_or("Media snapshot expired")?;
    if snapshot.id != snapshot_id {
        return Err("Media snapshot expired".to_string());
    }
    Ok(timeline_buckets(&snapshot.items, utc_offset_minutes))
}

fn media_item(entry_path: &Path, file_name: String, metadata: Option<fs::Metadata>) -> FileItem {
    let extension = entry_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();
    let media_type = classify_extension(&extension);
    let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
    let modified_ms = metadata
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    FileItem {
        name: file_name,
        path: entry_path.to_string_lossy().to_string(),
        is_dir: false,
        size,
        modified_ms,
        extension,
        media_type,
        width: None,
        height: None,
    }
}

/// Every image and video under `root` (no folders), bounded in count and depth.
/// Returns whether the walk stopped at the file limit.
fn collect_media_recursive(root: &Path, items: &mut Vec<FileItem>) -> bool {
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') {
                continue;
            }
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            // Symlinks are not followed: no cycles, no escaping the chosen folder.
            if file_type.is_symlink() {
                continue;
            }
            let entry_path = entry.path();
            if file_type.is_dir() {
                let lower = file_name.to_lowercase();
                if depth + 1 < RECURSIVE_DEPTH_LIMIT && !SKIPPED_DIRS.contains(&lower.as_str()) {
                    stack.push((entry_path, depth + 1));
                }
                continue;
            }
            let item = media_item(&entry_path, file_name, entry.metadata().ok());
            if item.media_type == "image" || item.media_type == "video" {
                items.push(item);
                if items.len() >= RECURSIVE_FILE_LIMIT {
                    return true;
                }
            }
        }
    }
    false
}

fn natural_name_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let a = a.to_lowercase();
    let b = b.to_lowercase();
    let left = a.as_bytes();
    let right = b.as_bytes();
    let (mut i, mut j) = (0, 0);
    while i < left.len() && j < right.len() {
        if left[i].is_ascii_digit() && right[j].is_ascii_digit() {
            let start_i = i;
            let start_j = j;
            while i < left.len() && left[i].is_ascii_digit() {
                i += 1;
            }
            while j < right.len() && right[j].is_ascii_digit() {
                j += 1;
            }
            let digits_i = &left[start_i..i];
            let digits_j = &right[start_j..j];
            let value_i = digits_i
                .iter()
                .position(|digit| *digit != b'0')
                .unwrap_or(digits_i.len() - 1);
            let value_j = digits_j
                .iter()
                .position(|digit| *digit != b'0')
                .unwrap_or(digits_j.len() - 1);
            let value_i = &digits_i[value_i..];
            let value_j = &digits_j[value_j..];
            let order = value_i
                .len()
                .cmp(&value_j.len())
                .then_with(|| value_i.cmp(value_j));
            if !order.is_eq() {
                return order;
            }
            continue;
        }
        let order = left[i].cmp(&right[j]);
        if !order.is_eq() {
            return order;
        }
        i += 1;
        j += 1;
    }
    left.len().cmp(&right.len())
}

// Tauri commands receive their arguments flat from the frontend.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn get_media_page(
    app: tauri::AppHandle,
    path: String,
    search_query: String,
    sort_field: String,
    sort_order: String,
    snapshot_id: Option<u64>,
    offset: usize,
    page_size: usize,
    kind: Option<String>,
    recursive: Option<bool>,
) -> Result<MediaPageResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<MediaPageState>();
        get_media_page_blocking(
            &state,
            MediaQuery {
                path,
                search_query,
                sort_field,
                sort_order,
                kind: kind.unwrap_or_else(|| "all".to_string()),
                recursive: recursive.unwrap_or(false),
            },
            snapshot_id,
            offset,
            page_size,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

/// What a media snapshot is built from.
struct MediaQuery {
    path: String,
    search_query: String,
    sort_field: String,
    sort_order: String,
    /// "all" (folders + media, the folder view), "media" (images + videos),
    /// "image", or "video".
    kind: String,
    /// Include every subfolder (the timeline); folders themselves are omitted.
    recursive: bool,
}

fn get_media_page_blocking(
    state: &MediaPageState,
    query: MediaQuery,
    snapshot_id: Option<u64>,
    offset: usize,
    page_size: usize,
) -> Result<MediaPageResult, String> {
    if let Some(id) = snapshot_id {
        let mut page = {
            let guard = state.inner.lock().map_err(|e| e.to_string())?;
            let snapshot = guard.1.as_ref().ok_or("Media snapshot expired")?;
            if snapshot.id != id || snapshot.current_path != query.path {
                return Err("Media snapshot expired".to_string());
            }
            media_page(snapshot, offset, page_size)
        };
        fill_dimensions(&mut page.items);
        return Ok(page);
    }

    let request_id = {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        guard.0 = guard.0.wrapping_add(1);
        guard.0
    };
    let target = Path::new(&query.path);
    let (current_path, parent_path, scanned, truncated) = if query.recursive {
        if !target.is_dir() {
            return Err(format!("Path is not a directory: {}", query.path));
        }
        let mut items = Vec::new();
        let truncated = collect_media_recursive(target, &mut items);
        (
            target.to_string_lossy().to_string(),
            target.parent().map(|p| p.to_string_lossy().to_string()),
            items,
            truncated,
        )
    } else {
        let result = scan_directory(query.path.clone(), "media".to_string())?;
        (result.current_path, result.parent_path, result.items, false)
    };
    let needle = query.search_query.trim().to_lowercase();
    let mut items: Vec<FileItem> = scanned
        .into_iter()
        .filter(|item| match query.kind.as_str() {
            "media" => !item.is_dir,
            "image" => item.media_type == "image",
            "video" => item.media_type == "video",
            _ => true,
        })
        .filter(|item| needle.is_empty() || item.name.to_lowercase().contains(&needle))
        .collect();
    let image_count = items
        .iter()
        .filter(|item| item.media_type == "image")
        .count();
    let video_count = items
        .iter()
        .filter(|item| item.media_type == "video")
        .count();
    let sort_field = query.sort_field.as_str();
    let descending = query.sort_order == "desc";
    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return b.is_dir.cmp(&a.is_dir);
        }
        let order = match sort_field {
            "modified" => a.modified_ms.cmp(&b.modified_ms),
            "size" => a.size.cmp(&b.size),
            _ => natural_name_cmp(&a.name, &b.name),
        }
        .then_with(|| a.path.cmp(&b.path));
        if descending {
            order.reverse()
        } else {
            order
        }
    });

    let mut page = {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        if guard.0 != request_id {
            return Err("Media snapshot superseded".to_string());
        }
        let snapshot = MediaSnapshot {
            id: request_id,
            current_path,
            parent_path,
            items,
            image_count,
            video_count,
            truncated,
        };
        let page = media_page(&snapshot, 0, page_size);
        guard.1 = Some(snapshot);
        page
    };
    fill_dimensions(&mut page.items);
    Ok(page)
}

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "tiff", "avif",
];

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "ts", "m4v", "3gp", "rmvb",
];

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "aac", "ogg", "m4a", "wma", "opus"];

const DOCUMENT_EXTENSIONS: &[&str] = &[
    "pdf", "txt", "md", "docx", "xlsx", "pptx", "csv", "json", "xml", "html", "epub",
];

const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "tar", "gz", "7z", "rar", "bz2", "xz"];

fn classify_extension(ext: &str) -> String {
    let lower = ext.to_lowercase();
    if IMAGE_EXTENSIONS.contains(&lower.as_str()) {
        "image".to_string()
    } else if VIDEO_EXTENSIONS.contains(&lower.as_str()) {
        "video".to_string()
    } else if AUDIO_EXTENSIONS.contains(&lower.as_str()) {
        "audio".to_string()
    } else if DOCUMENT_EXTENSIONS.contains(&lower.as_str()) {
        "document".to_string()
    } else if ARCHIVE_EXTENSIONS.contains(&lower.as_str()) {
        "archive".to_string()
    } else {
        "other".to_string()
    }
}

#[tauri::command]
pub fn get_system_locations() -> Vec<QuickLocation> {
    let mut locations = Vec::new();

    // 1. Home directory
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| "/".to_string());

    let home_path = PathBuf::from(&home);

    locations.push(QuickLocation {
        name: "Home".to_string(),
        path: home.clone(),
        category: "home".to_string(),
    });

    let standard_folders = [
        ("Pictures", "pictures"),
        ("Videos", "videos"),
        ("Downloads", "downloads"),
        ("Documents", "documents"),
        ("Desktop", "desktop"),
    ];

    for (folder_name, cat) in standard_folders {
        let p = home_path.join(folder_name);
        if p.exists() {
            locations.push(QuickLocation {
                name: folder_name.to_string(),
                path: p.to_string_lossy().to_string(),
                category: cat.to_string(),
            });
        }
    }

    // Windows drives (C:, D:, etc.)
    #[cfg(target_os = "windows")]
    {
        for b in b'A'..=b'Z' {
            let drive_letter = b as char;
            let drive_path = format!("{}:\\", drive_letter);
            if Path::new(&drive_path).exists() {
                locations.push(QuickLocation {
                    name: format!("Local Disk ({}:)", drive_letter),
                    path: drive_path,
                    category: "drive".to_string(),
                });
            }
        }
    }

    // Unix / macOS volumes
    #[cfg(not(target_os = "windows"))]
    {
        locations.push(QuickLocation {
            name: "Root (/)".to_string(),
            path: "/".to_string(),
            category: "drive".to_string(),
        });

        let volumes_path = Path::new("/Volumes");
        if volumes_path.exists() {
            if let Ok(entries) = fs::read_dir(volumes_path) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        locations.push(QuickLocation {
                            name,
                            path: p.to_string_lossy().to_string(),
                            category: "drive".to_string(),
                        });
                    }
                }
            }
        }
    }

    locations
}

#[tauri::command]
pub fn scan_directory(path: String, filter_mode: String) -> Result<DirectoryScanResult, String> {
    let target_path = Path::new(&path);
    if !target_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !target_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let parent_path = target_path
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let entries = fs::read_dir(target_path).map_err(|e| e.to_string())?;
    let mut items = Vec::new();

    let is_media_mode = filter_mode == "media";

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories (starting with dot)
        if file_name.starts_with('.') {
            continue;
        }

        let is_dir = entry_path.is_dir();
        let extension = entry_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        let media_type = if is_dir {
            "directory".to_string()
        } else {
            classify_extension(&extension)
        };

        // If in media mode, only keep directories and images/videos
        if is_media_mode && !is_dir && media_type != "image" && media_type != "video" {
            continue;
        }

        let metadata = entry.metadata().ok();
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_ms = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        items.push(FileItem {
            name: file_name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            size,
            modified_ms,
            extension,
            media_type,
            width: None,
            height: None,
        });
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(DirectoryScanResult {
        current_path: target_path.to_string_lossy().to_string(),
        parent_path,
        items,
    })
}

#[tauri::command]
pub fn open_file_in_os(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(path: String, search: String, field: String, order: String) -> MediaQuery {
        MediaQuery {
            path,
            search_query: search,
            sort_field: field,
            sort_order: order,
            kind: "all".into(),
            recursive: false,
        }
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("novus-{tag}-{unique}"))
    }

    #[test]
    fn timeline_scan_walks_subfolders_and_filters_by_kind() {
        let directory = temp_dir("timeline");
        fs::create_dir_all(directory.join("trip/day1")).unwrap();
        fs::create_dir_all(directory.join(".hidden")).unwrap();
        image::RgbImage::new(40, 30)
            .save(directory.join("trip/day1/a.png"))
            .unwrap();
        fs::write(directory.join("clip.mp4"), "v").unwrap();
        fs::write(directory.join(".hidden/b.jpg"), "x").unwrap();
        fs::write(directory.join("notes.txt"), "t").unwrap();
        let path = directory.to_string_lossy().to_string();
        let state = MediaPageState::default();

        let mut timeline = query(path.clone(), "".into(), "name".into(), "asc".into());
        timeline.kind = "media".into();
        timeline.recursive = true;
        let page = get_media_page_blocking(&state, timeline, None, 0, 10).unwrap();
        let names: Vec<_> = page.items.iter().map(|item| item.name.as_str()).collect();
        assert_eq!(names, ["a.png", "clip.mp4"]);
        assert!(!page.truncated);
        // Dimensions come from the header of the nested image.
        assert_eq!(
            (page.items[0].width, page.items[0].height),
            (Some(40), Some(30))
        );
        assert_eq!(page.items[1].width, None);

        let mut videos = query(path, "".into(), "name".into(), "asc".into());
        videos.kind = "video".into();
        videos.recursive = true;
        let page = get_media_page_blocking(&state, videos, None, 0, 10).unwrap();
        assert_eq!(page.total_count, 1);
        assert_eq!(page.video_count, 1);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn civil_dates_and_month_runs() {
        assert_eq!(civil_year_month(0), (1970, 1));
        assert_eq!(civil_year_month(19_723), (2024, 1)); // 2024-01-01
        assert_eq!(civil_year_month(19_782), (2024, 2)); // 2024-02-29 (leap day)
        let at = |ms: u64| FileItem {
            name: "x".into(),
            path: "x".into(),
            is_dir: false,
            size: 0,
            modified_ms: ms,
            extension: "jpg".into(),
            media_type: "image".into(),
            width: None,
            height: None,
        };
        // 2024-02-29 15:30 UTC is already March 1st in Seoul (UTC+9).
        let leap_afternoon = 1_709_220_600_000;
        let items = vec![
            at(1_709_251_200_000),
            at(leap_afternoon),
            at(1_706_745_600_000),
        ];
        assert_eq!(
            timeline_buckets(&items, 540),
            vec![
                TimelineBucket {
                    year: 2024,
                    month: 3,
                    count: 2,
                    first_index: 0
                },
                TimelineBucket {
                    year: 2024,
                    month: 2,
                    count: 1,
                    first_index: 2
                },
            ]
        );
        assert_eq!(timeline_buckets(&items, 0)[1].count, 2);
    }

    #[test]
    fn media_pages_keep_sorted_order_and_invalidate_old_snapshots() {
        let unique = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("novus-media-page-{unique}"));
        fs::create_dir_all(directory.join("folder")).unwrap();
        for name in ["a.jpg", "b.jpg", "c.jpg"] {
            fs::write(directory.join(name), name).unwrap();
        }
        let path = directory.to_string_lossy().to_string();
        let state = MediaPageState::default();
        let first = get_media_page_blocking(
            &state,
            query(path.clone(), "".into(), "name".into(), "asc".into()),
            None,
            0,
            2,
        )
        .unwrap();
        assert_eq!(first.total_count, 4);
        assert_eq!(first.image_count, 3);
        assert_eq!(
            first
                .items
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>(),
            ["folder", "a.jpg"]
        );
        let second = get_media_page_blocking(
            &state,
            query(path.clone(), "".into(), "name".into(), "asc".into()),
            Some(first.snapshot_id),
            2,
            2,
        )
        .unwrap();
        assert_eq!(
            second
                .items
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>(),
            ["b.jpg", "c.jpg"]
        );
        assert!(!second.has_more);

        let filtered = get_media_page_blocking(
            &state,
            query(path.clone(), "c.jpg".into(), "name".into(), "asc".into()),
            None,
            0,
            2,
        )
        .unwrap();
        assert_eq!(filtered.total_count, 1);
        assert!(get_media_page_blocking(
            &state,
            query(path, "".into(), "name".into(), "asc".into()),
            Some(first.snapshot_id),
            2,
            2,
        )
        .is_err());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn media_names_sort_numeric_runs_naturally() {
        assert!(natural_name_cmp("photo2.jpg", "photo10.jpg").is_lt());
        assert!(natural_name_cmp("Photo02.jpg", "photo2.jpg").is_gt());
    }
}
