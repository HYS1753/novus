use base64::prelude::*;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};

fn get_cache_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("novus_thumbnails");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn compute_hash(s: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

#[tauri::command]
pub fn cleanup_thumbnail_cache() -> Result<(), String> {
    let dir = get_cache_dir();
    if dir.exists() {
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::create_dir_all(&dir);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_image_thumbnail(
    file_path: String,
    max_dim: Option<u32>,
) -> Result<String, String> {
    let max_dim = max_dim.unwrap_or(256);
    let target_path = Path::new(&file_path);
    if !target_path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let cache_dir = get_cache_dir();
    let cache_key = format!("{}_{}", compute_hash(&file_path), max_dim);
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
        let _ = fs::write(&cache_file, &bytes);

        let encoded = BASE64_STANDARD.encode(bytes);
        Ok(format!("data:image/jpeg;base64,{}", encoded))
    })
    .await
    .map_err(|e| e.to_string())?
}
