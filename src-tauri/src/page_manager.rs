use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone)]
pub struct ManagedPage {
    pub id: String,
    pub url: String,
    pub label: String,
    pub bounds: PageBounds,
    pub is_visible: bool,
}

#[derive(Default)]
pub struct PageManagerState {
    pub pages: Mutex<HashMap<String, ManagedPage>>,
    pub current_visible_id: Mutex<Option<String>>,
}

impl PageManagerState {
    pub fn new() -> Self {
        Self {
            pages: Mutex::new(HashMap::new()),
            current_visible_id: Mutex::new(None),
        }
    }
}

pub fn get_page_label(id: &str) -> String {
    format!("child-{}", id)
}

/// Shows a streaming page mapped to `id` in the singleton Chromium / WebView2 engine.
/// If already created, updates its bounds, makes it visible, and hides any previously active page.
/// If not created, lazily constructs the webview child attached to the main window.
#[tauri::command]
pub async fn show_streaming_page(
    app: AppHandle,
    state: tauri::State<'_, PageManagerState>,
    id: String,
    url: String,
    bounds: PageBounds,
) -> Result<(), String> {
    let main_window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let label = get_page_label(&id);

    // 1. Hide previously visible page if it's different from the target
    {
        let mut curr_guard = state
            .current_visible_id
            .lock()
            .map_err(|e| e.to_string())?;

        if let Some(ref prev_id) = *curr_guard {
            if prev_id != &id {
                let prev_label = get_page_label(prev_id);
                if let Some(prev_webview) = app.get_webview(&prev_label) {
                    let _ = prev_webview.hide();
                    // Also move offscreen as extra guard on platforms where hide leaves artifacts
                    let _ = prev_webview.set_position(LogicalPosition::new(-9999.0, -9999.0));
                }
                let mut pages_guard = state.pages.lock().map_err(|e| e.to_string())?;
                if let Some(prev_page) = pages_guard.get_mut(prev_id) {
                    prev_page.is_visible = false;
                }
            }
        }
        *curr_guard = Some(id.clone());
    }

    // 2. Check if the webview already exists in Tauri
    if let Some(existing_webview) = app.get_webview(&label) {
        // Restore position and size
        let _ = existing_webview.set_position(LogicalPosition::new(bounds.x, bounds.y));
        let _ = existing_webview.set_size(LogicalSize::new(bounds.width, bounds.height));
        let _ = existing_webview.show();
        let _ = existing_webview.set_focus();

        let mut pages_guard = state.pages.lock().map_err(|e| e.to_string())?;
        pages_guard.insert(
            id.clone(),
            ManagedPage {
                id,
                url,
                label,
                bounds,
                is_visible: true,
            },
        );

        return Ok(());
    }

    // 3. Lazy creation: Instantiate child webview inside main window
    let parsed_url = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;

    // User-Agent Strategy:
    // Do NOT inject a fake synthetic User-Agent on YouTube / Google authentication pages,
    // as Google's anti-abuse engine compares the UA header against actual engine JavaScript features (Sec-CH-UA / client hints).
    // Only inject desktop Chrome UA for OTTs (e.g. Coupang Play) that strictly require it.
    let is_google_or_youtube = id == "youtube"
        || url.contains("youtube.com")
        || url.contains("google.com");
    // Track internal navigation depth for SPAs (like YouTube) so we can accurately detect
    // when we are back at the entry point and should close the view.
    let init_script = r#"
        (function() {
            if (window.__novus_depth_initialized) return;
            window.__novus_depth_initialized = true;
            window.__novus_nav_depth = 0;

            var origPush = history.pushState;
            history.pushState = function() {
                window.__novus_nav_depth++;
                return origPush.apply(this, arguments);
            };

            var origReplace = history.replaceState;
            history.replaceState = function() {
                return origReplace.apply(this, arguments);
            };

            window.addEventListener('popstate', function() {
                if (window.__novus_nav_depth > 0) {
                    window.__novus_nav_depth--;
                }
            });
        })();
    "#;

    let mut webview_builder = WebviewBuilder::new(&label, WebviewUrl::External(parsed_url))
        .initialization_script(init_script)
        .accept_first_mouse(true);

    if !is_google_or_youtube {
        let desktop_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
        webview_builder = webview_builder.user_agent(desktop_ua);
    }

    main_window
        .add_child(
            webview_builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )
        .map_err(|e| e.to_string())?;

    if let Some(created_webview) = app.get_webview(&label) {
        let _ = created_webview.show();
        let _ = created_webview.set_focus();
    }

    let mut pages_guard = state.pages.lock().map_err(|e| e.to_string())?;
    pages_guard.insert(
        id.clone(),
        ManagedPage {
            id,
            url,
            label,
            bounds,
            is_visible: true,
        },
    );

    Ok(())
}

/// Hides a streaming page from the viewport.
/// Keeps the underlying page, DOM, and login session intact.
#[tauri::command]
pub async fn hide_streaming_page(
    app: AppHandle,
    state: tauri::State<'_, PageManagerState>,
    id: String,
) -> Result<(), String> {
    let label = get_page_label(&id);

    if let Some(existing_webview) = app.get_webview(&label) {
        let _ = existing_webview.hide();
        let _ = existing_webview.set_position(LogicalPosition::new(-9999.0, -9999.0));
    }

    let mut curr_guard = state
        .current_visible_id
        .lock()
        .map_err(|e| e.to_string())?;
    if curr_guard.as_deref() == Some(&id) {
        *curr_guard = None;
    }

    let mut pages_guard = state.pages.lock().map_err(|e| e.to_string())?;
    if let Some(page) = pages_guard.get_mut(&id) {
        page.is_visible = false;
    }

    Ok(())
}

/// Updates bounds (x, y, width, height) of an existing streaming page without reloading or recreating.
#[tauri::command]
pub async fn update_streaming_page_bounds(
    app: AppHandle,
    state: tauri::State<'_, PageManagerState>,
    id: String,
    bounds: PageBounds,
) -> Result<(), String> {
    let label = get_page_label(&id);

    if let Some(existing_webview) = app.get_webview(&label) {
        let _ = existing_webview.set_position(LogicalPosition::new(bounds.x, bounds.y));
        let _ = existing_webview.set_size(LogicalSize::new(bounds.width, bounds.height));
    }

    let mut pages_guard = state.pages.lock().map_err(|e| e.to_string())?;
    if let Some(page) = pages_guard.get_mut(&id) {
        page.bounds = bounds;
    }

    Ok(())
}

/// Reloads the contents of a streaming page without tearing down the browser process.
#[tauri::command]
pub async fn reload_streaming_page(app: AppHandle, id: String) -> Result<(), String> {
    let label = get_page_label(&id);

    if let Some(existing_webview) = app.get_webview(&label) {
        existing_webview.reload().map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Discards/destroys a background page to relieve system memory under pressure.
/// The browser process itself and user session cookies remain persistent.
#[tauri::command]
pub async fn discard_streaming_page(
    app: AppHandle,
    state: tauri::State<'_, PageManagerState>,
    id: String,
) -> Result<(), String> {
    let label = get_page_label(&id);

    if let Some(existing_webview) = app.get_webview(&label) {
        let _ = existing_webview.close();
    }

    let mut curr_guard = state
        .current_visible_id
        .lock()
        .map_err(|e| e.to_string())?;
    if curr_guard.as_deref() == Some(&id) {
        *curr_guard = None;
    }

    let mut pages_guard = state.pages.lock().map_err(|e| e.to_string())?;
    pages_guard.remove(&id);

    Ok(())
}

/// Navigates the streaming page back in history.
/// If there is no previous history (or on error), returns Ok(false) so the frontend can close and release memory.
/// If navigation succeeds, returns Ok(true).
#[tauri::command]
pub async fn go_back_or_close_streaming_page(
    app: AppHandle,
    state: tauri::State<'_, PageManagerState>,
    id: String,
) -> Result<bool, String> {
    let label = get_page_label(&id);

    let webview = match app.get_webview(&label) {
        Some(wv) => wv,
        None => return Ok(false),
    };

    let (tx, rx) = std::sync::mpsc::channel::<bool>();

    // Check if we can go back in navigation history
    let js = r#"
        (function() {
            try {
                // 1. If Modern Navigation API is available, check canGoBack directly
                if (window.navigation && typeof window.navigation.canGoBack === "boolean") {
                    if (window.navigation.canGoBack) {
                        window.history.back();
                        return "navigated";
                    } else {
                        return "cannot_back";
                    }
                }

                // 2. If SPA depth tracker was active, check if we pushed any subpages
                if (typeof window.__novus_nav_depth === "number") {
                    if (window.__novus_nav_depth > 0) {
                        window.history.back();
                        return "navigated";
                    } else {
                        return "cannot_back";
                    }
                }

                // 3. Fallback to standard history.length check
                if (window.history && window.history.length > 1) {
                    window.history.back();
                    return "navigated";
                }
            } catch (e) {}
            return "cannot_back";
        })()
    "#;

    let eval_res = webview.eval_with_callback(js, move |res| {
        let went_back = res.contains("navigated");
        let _ = tx.send(went_back);
    });

    if eval_res.is_err() {
        let _ = discard_streaming_page(app, state, id).await;
        return Ok(false);
    }

    match rx.recv_timeout(std::time::Duration::from_millis(500)) {
        Ok(true) => Ok(true),
        _ => {
            // Cannot go back further: discard page to free memory
            let _ = discard_streaming_page(app, state, id).await;
            Ok(false)
        }
    }
}
