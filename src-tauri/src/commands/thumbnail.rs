use base64::prelude::*;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::UNIX_EPOCH;
use tauri::Manager;

const MAX_CACHE_BYTES: u64 = 256 * 1024 * 1024;
static CACHE_WRITES: AtomicUsize = AtomicUsize::new(0);

fn get_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbnails");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn compute_hash(s: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

#[tauri::command]
pub fn cleanup_thumbnail_cache(app: tauri::AppHandle) -> Result<(), String> {
    let dir = get_cache_dir(&app)?;
    if dir.exists() {
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::create_dir_all(&dir);
    }
    Ok(())
}

fn prune_cache(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files = Vec::new();
    let mut total = 0;
    for entry in entries.flatten() {
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file() && entry.path().extension().is_some_and(|ext| ext == "jpg") {
                total += metadata.len();
                files.push((entry.path(), metadata.len(), metadata.modified().ok()));
            }
        }
    }
    if total <= MAX_CACHE_BYTES {
        return;
    }
    files.sort_by_key(|(_, _, modified)| *modified);
    for (path, size, _) in files {
        if total <= MAX_CACHE_BYTES {
            break;
        }
        if fs::remove_file(path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
}

#[tauri::command]
pub async fn get_image_thumbnail(
    app: tauri::AppHandle,
    file_path: String,
    max_dim: Option<u32>,
) -> Result<String, String> {
    let max_dim = max_dim.unwrap_or(256).clamp(64, 3200);
    let target_path = Path::new(&file_path);
    let metadata = fs::metadata(target_path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err(format!("Not a file: {}", file_path));
    }

    let cache_dir = get_cache_dir(&app)?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|time| time.as_nanos())
        .unwrap_or(0);
    let cache_key = format!(
        "{}_{}_{}_v2",
        compute_hash(&file_path),
        metadata.len(),
        modified
    );
    let cache_key = format!("{}_{}", compute_hash(&cache_key), max_dim);
    let cache_file = cache_dir.join(format!("{}.jpg", cache_key));

    // If already cached in temp dir, read and return directly
    if cache_file.exists() {
        if let Ok(bytes) = fs::read(&cache_file) {
            let encoded = BASE64_STANDARD.encode(bytes);
            return Ok(format!("data:image/jpeg;base64,{}", encoded));
        }
    }

    // Generate thumbnail in blocking threadpool to avoid freezing UI
    let file_path_clone = file_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let img = image::open(&file_path_clone).map_err(|e| e.to_string())?;

        // Fast downsampling with triangle filter for low-spec Surface Pro 4
        let thumb = img.thumbnail(max_dim, max_dim);

        let mut buffer = Cursor::new(Vec::new());
        // Encode as JPEG with ~75% quality for ultra-low memory & fast transfer
        thumb
            .write_to(&mut buffer, image::ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;

        let bytes = buffer.into_inner();
        let temp_file = cache_file.with_extension(format!("{}.tmp", std::process::id()));
        if fs::write(&temp_file, &bytes).is_ok() {
            if fs::rename(&temp_file, &cache_file).is_err() {
                let _ = fs::remove_file(&temp_file);
            }
        }
        if CACHE_WRITES.fetch_add(1, Ordering::Relaxed) % 32 == 0 {
            prune_cache(&cache_dir);
        }

        let encoded = BASE64_STANDARD.encode(bytes);
        Ok(format!("data:image/jpeg;base64,{}", encoded))
    })
    .await
    .map_err(|e| e.to_string())?
}
