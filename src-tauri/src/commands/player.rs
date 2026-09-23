use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayResult {
    pub success: bool,
    pub used_mpv: bool,
    pub message: String,
}

fn find_mpv_binary() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. Check adjacent binary / bundled sidecar directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("mpv"));
            candidates.push(exe_dir.join("mpv.exe"));
            candidates.push(exe_dir.join("bin").join("mpv"));
            candidates.push(exe_dir.join("bin").join("mpv.exe"));
            candidates.push(exe_dir.join("resources").join("bin").join("mpv"));
            candidates.push(exe_dir.join("resources").join("bin").join("mpv.exe"));
            candidates.push(exe_dir.join("..").join("Resources").join("bin").join("mpv"));
            candidates.push(exe_dir.join("resources").join("mpv").join("mpv.exe"));
        }
    }

    // 2. Check project / workspace source directories (for development mode)
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("bin").join("mpv"));
        candidates.push(cwd.join("src-tauri").join("bin").join("mpv.exe"));
        candidates.push(cwd.join("bin").join("mpv"));
        candidates.push(cwd.join("bin").join("mpv.exe"));
    }

    // 3. User home / local app data paths
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        let home_p = PathBuf::from(home);
        candidates.push(home_p.join(".local").join("bin").join("mpv"));
        candidates.push(home_p.join("bin").join("mpv"));
        candidates.push(
            home_p
                .join("AppData")
                .join("Local")
                .join("Programs")
                .join("mpv")
                .join("mpv.exe"),
        );
        candidates.push(
            home_p
                .join("scoop")
                .join("apps")
                .join("mpv")
                .join("current")
                .join("mpv.exe"),
        );
    }

    // 4. Standard OS installation paths
    candidates.push(PathBuf::from("/opt/homebrew/bin/mpv"));
    candidates.push(PathBuf::from("/usr/local/bin/mpv"));
    candidates.push(PathBuf::from("/usr/bin/mpv"));
    candidates.push(PathBuf::from("C:\\Program Files\\mpv\\mpv.exe"));
    candidates.push(PathBuf::from("C:\\mpv\\mpv.exe"));

    // Check existing file paths first
    for candidate in &candidates {
        if candidate.exists() {
            if let Ok(output) = Command::new(candidate).arg("--version").output() {
                if output.status.success() {
                    return Some(candidate.clone());
                }
            }
        }
    }

    // 5. Finally check system PATH binary "mpv"
    if let Ok(output) = Command::new("mpv").arg("--version").output() {
        if output.status.success() {
            return Some(PathBuf::from("mpv"));
        }
    }

    None
}

#[tauri::command]
pub fn play_video_native(file_path: String) -> Result<PlayResult, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    // Try finding mpv on the host system or bundled path
    if let Some(mpv_path) = find_mpv_binary() {
        // Launch mpv with hardware acceleration and optimal desktop/tablet flags
        let spawn_res = Command::new(mpv_path)
            .arg("--hwdec=auto-safe")
            .arg("--keep-open=yes")
            .arg("--force-window=yes")
            .arg("--autofit=85%x85%")
            .arg("--geometry=50%:50%")
            .arg(format!(
                "--title=Novus Video Player - {}",
                path.file_name().and_then(|n| n.to_str()).unwrap_or("Media")
            ))
            .arg(&file_path)
            .spawn();

        match spawn_res {
            Ok(_) => {
                return Ok(PlayResult {
                    success: true,
                    used_mpv: true,
                    message: "MPV 하드웨어 가속 플레이어로 열었습니다.".to_string(),
                });
            }
            Err(e) => {
                eprintln!(
                    "Failed to spawn mpv: {}. Falling back to system default player.",
                    e
                );
            }
        }
    }

    // Fallback: Open with default OS media player
    tauri_plugin_opener::open_path(&file_path, None::<&str>)
        .map_err(|e| format!("Failed to open with system player: {}", e))?;

    Ok(PlayResult {
        success: true,
        used_mpv: false,
        message: "MPV 실행 파일이 설치 또는 번들되어 있지 않아 시스템 기본 플레이어로 열었습니다."
            .to_string(),
    })
}
