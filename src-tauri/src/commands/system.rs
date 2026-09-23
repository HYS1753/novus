use std::process::Command;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn get_system_status() -> Result<String, String> {
    Ok("healthy".to_string())
}

#[tauri::command]
pub async fn open_media_window(
    app: AppHandle,
    id: String,
    title: String,
    url: String,
) -> Result<(), String> {
    let window_label = format!("media-{}", id);
    if let Some(existing) = app.get_webview_window(&window_label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let parsed_url = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;

    // High compatibility Chrome Desktop User-Agent string to bypass Coupang Play / OTT blocks
    let chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::External(parsed_url))
        .title(&title)
        .user_agent(chrome_ua)
        .inner_size(1280.0, 800.0)
        .center()
        .decorations(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_media_window(app: AppHandle, id: String) -> Result<(), String> {
    let window_label = format!("media-{}", id);
    if let Some(existing) = app.get_webview_window(&window_label) {
        let _ = existing.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn attach_child_webview(
    app: AppHandle,
    state: tauri::State<'_, crate::page_manager::PageManagerState>,
    id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    crate::page_manager::show_streaming_page(
        app,
        state,
        id,
        url,
        crate::page_manager::PageBounds {
            x,
            y,
            width,
            height,
        },
    )
    .await
}

#[tauri::command]
pub async fn close_child_webview(
    app: AppHandle,
    state: tauri::State<'_, crate::page_manager::PageManagerState>,
    id: String,
) -> Result<(), String> {
    crate::page_manager::hide_streaming_page(app, state, id).await
}

#[tauri::command]
pub fn launch_native_app_mode(url: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        // Try Edge Application Mode (PWA-style borderless window with full PlayReady + Widevine DRM)
        let edge_paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ];
        for path in edge_paths {
            if std::path::Path::new(path).exists() {
                if let Ok(_) = Command::new(path).arg(format!("--app={}", url)).spawn() {
                    return Ok(true);
                }
            }
        }
        // Fallback to start msedge via cmd
        if let Ok(_) = Command::new("cmd")
            .args(["/c", "start", "msedge.exe", &format!("--app={}", url)])
            .spawn()
        {
            return Ok(true);
        }
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS try Chrome app mode
        if let Ok(_) = Command::new("open")
            .args(["-na", "Google Chrome", "--args", &format!("--app={}", url)])
            .spawn()
        {
            return Ok(true);
        }
    }

    Ok(false)
}
