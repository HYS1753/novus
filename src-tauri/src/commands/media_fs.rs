use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize)]
pub struct QuickLocation {
    pub name: String,
    pub path: String,
    pub category: String, // "drive" | "home" | "pictures" | "videos" | "downloads" | "documents" | "desktop"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub extension: String,
    pub media_type: String, // "directory" | "image" | "video" | "audio" | "document" | "archive" | "other"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryScanResult {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub items: Vec<FileItem>,
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
