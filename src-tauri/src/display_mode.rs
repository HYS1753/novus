//! Window fullscreen preference is independent of a temporary web-player fullscreen session.
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplayMode {
    pub app_fullscreen: bool,
    pub content_page: Option<String>,
    pub revision: u64,
}

impl DisplayMode {
    fn fullscreen(&self) -> bool {
        self.app_fullscreen || self.content_page.is_some()
    }

    fn set_content(&mut self, id: &str, fullscreen: bool) {
        if fullscreen {
            self.content_page = Some(id.into());
        } else if self.content_page.as_deref() == Some(id) {
            self.content_page = None;
        }
        self.revision += 1;
    }
}

#[derive(Default)]
pub struct DisplayModeState(pub Mutex<DisplayMode>);

fn apply(app: &AppHandle, next: DisplayMode) -> Result<DisplayMode, String> {
    let main = app.get_window("main").ok_or("Main window not found")?;
    // Tauri also handles WebView2's HTML fullscreen event. This runs after that
    // handler so leaving HTML fullscreen restores the user's Novus preference.
    let changed = main.is_fullscreen().map_err(|e| e.to_string())? != next.fullscreen();
    if changed {
        main.set_fullscreen(next.fullscreen())
            .map_err(|e| e.to_string())?;
    }
    *app.state::<DisplayModeState>()
        .0
        .lock()
        .map_err(|e| e.to_string())? = next.clone();
    sync_content_bounds(app);
    app.emit("novus-display-mode", &next)
        .map_err(|e| e.to_string())?;
    if changed {
        // Resizing the owner can return keyboard focus to its HWND. Keep the
        // video controls webview focused so the next Escape/F remains usable.
        for (label, overlay) in app.webview_windows() {
            if label.starts_with("video-controls-") {
                let _ = overlay.set_focus();
                if let Some(webview) = app.get_webview(&label) {
                    let _ = webview.set_focus();
                }
            }
        }
    }
    Ok(next)
}

fn current(app: &AppHandle) -> Result<DisplayMode, String> {
    Ok(app
        .state::<DisplayModeState>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .clone())
}

#[tauri::command]
pub fn get_display_mode(app: AppHandle) -> Result<DisplayMode, String> {
    current(&app)
}

/// Complete native work on the UI thread, without blocking its event loop.
#[tauri::command]
pub async fn toggle_window_fullscreen(app: AppHandle) -> Result<DisplayMode, String> {
    change_window_mode(app, true).await
}

#[tauri::command]
pub async fn exit_window_fullscreen(app: AppHandle) -> Result<DisplayMode, String> {
    change_window_mode(app, false).await
}

async fn change_window_mode(app: AppHandle, toggle: bool) -> Result<DisplayMode, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let task_app = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            let mut next = current(&task_app)?;
            next.app_fullscreen = toggle && !next.app_fullscreen;
            next.revision += 1;
            apply(&task_app, next)
        })();
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(std::time::Duration::from_secs(3))
            .map_err(|_| "Window fullscreen transition timed out".to_string())?
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn clear_content(app: &AppHandle, id: &str) {
    queue_content(app, id.to_string(), false, None);
}

fn queue_content(app: &AppHandle, id: String, fullscreen: bool, generation: Option<u64>) {
    let task_app = app.clone();
    let _ = app.run_on_main_thread(move || {
        let result = (|| {
            let pages = task_app.state::<crate::page_manager::PageManagerState>();
            if let Some(generation) = generation {
                let valid = pages
                    .pages
                    .lock()
                    .map_err(|e| e.to_string())?
                    .get(&id)
                    .is_some_and(|page| page.generation == generation);
                if !valid {
                    apply(&task_app, current(&task_app)?)?;
                    return Ok(());
                }
            }
            if fullscreen
                && pages
                    .current_visible_id
                    .lock()
                    .map_err(|e| e.to_string())?
                    .as_deref()
                    != Some(&id)
            {
                if let Some(webview) =
                    task_app.get_webview(&crate::page_manager::get_page_label(&id))
                {
                    let _ = webview.eval(
                        "if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});",
                    );
                }
                apply(&task_app, current(&task_app)?)?;
                return Ok(());
            }
            let mut next = current(&task_app)?;
            next.set_content(&id, fullscreen);
            apply(&task_app, next)?;
            Ok::<_, String>(())
        })();
        if let Err(error) = result {
            let _ = task_app.emit("novus-display-error", error);
        }
    });
}

pub fn sync_content_bounds(app: &AppHandle) {
    let Ok(mode) = current(app) else { return };
    let Some(id) = mode.content_page else { return };
    let Some(main) = app.get_window("main") else {
        return;
    };
    let Some(webview) = app.get_webview(&crate::page_manager::get_page_label(&id)) else {
        return;
    };
    if let (Ok(size), Ok(scale)) = (main.inner_size(), main.scale_factor()) {
        let _ = webview.set_bounds(tauri::Rect {
            position: tauri::LogicalPosition::new(0.0, 0.0).into(),
            size: size.to_logical::<f64>(scale).into(),
        });
    }
}

#[tauri::command]
pub async fn exit_streaming_fullscreen(app: AppHandle, id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&crate::page_manager::get_page_label(&id)) {
        webview
            .eval("if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});")
            .map_err(|e| e.to_string())?;
    }
    // Do not clear state early: the native fullscreen-changed event acknowledges exit.
    Ok(())
}

#[cfg(windows)]
pub fn observe_streaming(app: &AppHandle, id: &str, generation: u64) -> Result<(), String> {
    use webview2_com::{
        AcceleratorKeyPressedEventHandler, ContainsFullScreenElementChangedEventHandler,
        Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
        },
        NavigationStartingEventHandler,
    };
    let webview = app
        .get_webview(&crate::page_manager::get_page_label(id))
        .ok_or("Streaming webview not found")?;
    let app = app.clone();
    let id = id.to_string();
    // run_on_main_thread executes inline when called by a COM callback. Dispatch
    // through one ordered async receiver so Tauri's already queued fullscreen
    // event is processed first. No polling, sleeps, or dedicated OS thread.
    let (events, mut receiver) = tauri::async_runtime::channel::<bool>(32);
    let event_app = app.clone();
    let event_id = id.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(fullscreen) = receiver.recv().await {
            queue_content(&event_app, event_id.clone(), fullscreen, Some(generation));
        }
    });
    webview
        .with_webview(move |platform| unsafe {
            let controller = platform.controller();
            let core = match controller.CoreWebView2() {
                Ok(core) => core,
                Err(_) => return,
            };
            let mut token = 0;
            let fullscreen_events = events.clone();
            let result = core.add_ContainsFullScreenElementChanged(
                &ContainsFullScreenElementChangedEventHandler::create(Box::new(
                    move |sender, _| {
                        if let Some(sender) = sender {
                            let mut fullscreen = Default::default();
                            sender.ContainsFullScreenElement(&mut fullscreen)?;
                            let _ = fullscreen_events.try_send(fullscreen.as_bool());
                        }
                        Ok(())
                    },
                )),
                &mut token,
            );
            if let Err(error) = result {
                let _ = app.emit("novus-display-error", error.to_string());
            }
            let _ = core.add_NavigationStarting(
                &NavigationStartingEventHandler::create(Box::new(move |_, _| {
                    let _ = events.try_send(false);
                    Ok(())
                })),
                &mut token,
            );
            let event_app = app.clone();
            let event_id = id.clone();
            let _ = controller.add_AcceleratorKeyPressed(
                &AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
                    if let Some(args) = args {
                        let mut key = 0;
                        let mut kind = Default::default();
                        args.VirtualKey(&mut key)?;
                        args.KeyEventKind(&mut kind)?;
                        let mode = current(&event_app).unwrap_or_default();
                        let back = key == 166
                            || (key == 37 && kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN);
                        if back && mode.content_page.as_deref() == Some(&event_id) {
                            args.SetHandled(true)?;
                            let app = event_app.clone();
                            let id = event_id.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = exit_streaming_fullscreen(app, id).await;
                            });
                            return Ok(());
                        }
                        if key == 27
                            && kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN
                            && mode.content_page.is_none()
                            && mode.app_fullscreen
                        {
                            args.SetHandled(true)?;
                            let app = event_app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = exit_window_fullscreen(app).await;
                            });
                            return Ok(());
                        }
                        if key == 122 && kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN {
                            args.SetHandled(true)?;
                            let mut status = Default::default();
                            args.PhysicalKeyStatus(&mut status)?;
                            if !status.WasKeyDown.as_bool() {
                                let app = event_app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = toggle_window_fullscreen(app).await;
                                });
                            }
                        }
                    }
                    Ok(())
                })),
                &mut token,
            );
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
pub fn observe_streaming(_app: &AppHandle, _id: &str, _generation: u64) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::DisplayMode;

    #[test]
    fn content_exit_preserves_app_fullscreen_preference() {
        for app_fullscreen in [false, true] {
            let mut mode = DisplayMode {
                app_fullscreen,
                ..Default::default()
            };
            mode.set_content("youtube", true);
            assert!(mode.fullscreen());
            mode.set_content("youtube", false);
            assert_eq!(mode.fullscreen(), app_fullscreen);
        }
    }

    #[test]
    fn stale_exit_cannot_clear_another_players_fullscreen() {
        let mut mode = DisplayMode::default();
        mode.set_content("youtube", true);
        mode.set_content("netflix", true);
        mode.set_content("youtube", false);
        assert_eq!(mode.content_page.as_deref(), Some("netflix"));
    }
}
