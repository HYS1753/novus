use serde::{Deserialize, Serialize};
use std::path::Path;
#[cfg(any(windows, target_os = "macos"))]
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn open_embedded_video_overlay(
    app: AppHandle,
    state: tauri::State<'_, EmbeddedPlayerState>,
    session_id: String,
    video: serde_json::Value,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        if !windows_player::is_current(&state.session, &session_id)? {
            return Err("Video session has changed".into());
        }
        let main = app
            .get_webview_window("main")
            .ok_or("Main window not found")?;
        let label = format!("video-controls-{session_id}");
        if let Some(old) = app.get_webview_window(&label) {
            old.destroy().map_err(|e| e.to_string())?;
        }
        let size = main.inner_size().map_err(|e| e.to_string())?;
        let position = main.inner_position().map_err(|e| e.to_string())?;
        let scale = main.scale_factor().map_err(|e| e.to_string())?;
        let bootstrap = serde_json::json!({ "sessionId": session_id, "video": video });
        let overlay = tauri::WebviewWindowBuilder::new(
            &app,
            &label,
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Novus 영상 조작")
        .initialization_script(format!("window.__NOVUS_VIDEO_OVERLAY__ = {bootstrap};"))
        .parent(&main)
        .map_err(|e| e.to_string())?
        .transparent(true)
        .decorations(false)
        .shadow(true)
        .skip_taskbar(true)
        .resizable(false)
        .position(position.x as f64 / scale, position.y as f64 / scale)
        .inner_size(size.width as f64 / scale, size.height as f64 / scale)
        .build()
        .map_err(|e| e.to_string())?;
        let close_app = app.clone();
        let close_id = session_id.clone();
        overlay.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = close_app.emit_to(
                    "main",
                    "embedded-video-input",
                    serde_json::json!({
                        "session_id": close_id, "action": "close",
                    }),
                );
            }
        });
        if !windows_player::is_current(&state.session, &session_id)? {
            let _ = overlay.destroy();
            return Err("Video session is closed".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, state, session_id, video);
        Err("Native overlay is only needed on Windows".into())
    }
}

#[tauri::command]
pub async fn request_embedded_video_overlay_action(
    app: AppHandle,
    session_id: String,
    action: String,
) -> Result<(), String> {
    if !["close", "exit", "fullscreen"].contains(&action.as_str()) {
        return Err("Invalid overlay action".into());
    }
    app.emit_to(
        "main",
        "embedded-video-input",
        serde_json::json!({"session_id": session_id, "action": action}),
    )
    .map_err(|e| e.to_string())
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct VideoBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl VideoBounds {
    fn is_valid(self) -> bool {
        [self.x, self.y, self.width, self.height]
            .iter()
            .all(|value| value.is_finite())
            && self.x >= 0.0
            && self.y >= 0.0
            && self.x <= 16384.0
            && self.y <= 16384.0
            && self.width >= 1.0
            && self.height >= 1.0
            && self.width <= 16384.0
            && self.height <= 16384.0
    }
}

#[derive(Debug, Serialize)]
pub struct EmbeddedPlayerSupport {
    pub platform: &'static str,
    pub available: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EmbeddedPlayerAction {
    TogglePause,
    Play,
    Pause,
    SeekBackward,
    SeekForward,
    ToggleMute,
    SeekTo(f64),
    SeekPercent(f64),
    SetVolume(f64),
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct EmbeddedVideoPlaybackState {
    pub position: f64,
    pub duration: f64,
    pub paused: bool,
    pub volume: f64,
    pub muted: bool,
}

#[cfg(any(windows, target_os = "macos"))]
pub enum PlayerMessage {
    Control(
        EmbeddedPlayerAction,
        std::sync::mpsc::SyncSender<Result<(), String>>,
    ),
    GetState(std::sync::mpsc::SyncSender<Result<EmbeddedVideoPlaybackState, String>>),
    Stop,
}

#[derive(Clone, Default)]
pub struct EmbeddedPlayerState {
    #[cfg(windows)]
    session: Arc<Mutex<Option<windows_player::Session>>>,
    #[cfg(target_os = "macos")]
    macos_session: Arc<Mutex<Option<super::macos_player::Session>>>,
}

#[tauri::command]
pub async fn get_embedded_player_support(app: AppHandle) -> Result<EmbeddedPlayerSupport, String> {
    let platform = app
        .try_state::<crate::commands::device_profile::DeviceProfile>()
        .ok_or_else(|| "Device profile is unavailable".to_string())?
        .os_family;
    #[cfg(windows)]
    {
        Ok(EmbeddedPlayerSupport {
            platform,
            available: windows_player::find_bundled_library(&app).is_some(),
        })
    }
    #[cfg(target_os = "macos")]
    {
        Ok(EmbeddedPlayerSupport {
            platform,
            available: tauri::async_runtime::spawn_blocking(move || {
                super::macos_player::library_available(&app)
            })
            .await
            .unwrap_or(false),
        })
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = app;
        Ok(EmbeddedPlayerSupport {
            platform,
            available: false,
        })
    }
}

#[tauri::command]
pub async fn open_embedded_video(
    app: AppHandle,
    state: tauri::State<'_, EmbeddedPlayerState>,
    session_id: String,
    file_path: String,
    bounds: VideoBounds,
) -> Result<(), String> {
    if session_id.is_empty() || session_id.len() > 128 {
        return Err("Invalid player session".into());
    }
    if !bounds.is_valid() {
        return Err("Invalid video bounds".into());
    }
    let path = Path::new(&file_path)
        .canonicalize()
        .map_err(|error| format!("Video file is unavailable: {error}"))?;
    if !path.is_file() {
        return Err("Video path is not a file".into());
    }

    #[cfg(windows)]
    {
        let sessions = state.session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            windows_player::open(&app, &sessions, session_id, path, bounds)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        let sessions = state.macos_session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            super::macos_player::open(&app, &sessions, session_id, path, bounds)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (app, state, path);
        Err("Native video output is unavailable on this platform".into())
    }
}

#[tauri::command]
pub async fn update_embedded_video_bounds(
    app: AppHandle,
    state: tauri::State<'_, EmbeddedPlayerState>,
    session_id: String,
    bounds: VideoBounds,
) -> Result<(), String> {
    if !bounds.is_valid() {
        return Err("Invalid video bounds".into());
    }
    #[cfg(windows)]
    {
        let sessions = state.session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            windows_player::resize(&app, &sessions, &session_id, bounds)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        let sessions = state.macos_session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            super::macos_player::resize(&app, &sessions, &session_id, bounds)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (app, state, session_id);
        Err("Native video output is unavailable on this platform".into())
    }
}

#[tauri::command]
pub async fn close_embedded_video(
    app: AppHandle,
    state: tauri::State<'_, EmbeddedPlayerState>,
    session_id: String,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let sessions = state.session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            windows_player::close(&app, &sessions, &session_id)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        let sessions = state.macos_session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            super::macos_player::close(&app, &sessions, &session_id)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (app, state, session_id);
        Ok(())
    }
}

#[tauri::command]
pub async fn control_embedded_video(
    state: tauri::State<'_, EmbeddedPlayerState>,
    session_id: String,
    action: EmbeddedPlayerAction,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let sessions = state.session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            windows_player::control(&sessions, &session_id, action)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        let sessions = state.macos_session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            super::macos_player::control(&sessions, &session_id, action)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (state, session_id, action);
        Err("Native video output is unavailable on this platform".into())
    }
}

#[tauri::command]
pub async fn get_embedded_video_state(
    state: tauri::State<'_, EmbeddedPlayerState>,
    session_id: String,
) -> Result<EmbeddedVideoPlaybackState, String> {
    #[cfg(windows)]
    {
        let sessions = state.session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            windows_player::get_state(&sessions, &session_id)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        let sessions = state.macos_session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            super::macos_player::get_state(&sessions, &session_id)
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (state, session_id);
        Err("Native video output is unavailable on this platform".into())
    }
}

#[cfg(windows)]
mod windows_player {
    use super::{EmbeddedPlayerAction, PlayerMessage, VideoBounds};
    use serde::Serialize;
    use std::ffi::{c_char, c_int, c_void, CStr, CString, OsStr};
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::sync::{mpsc, Arc, Mutex};
    use std::thread::{self, JoinHandle};
    use std::time::Duration;
    use tauri::{AppHandle, Emitter, Manager};

    type NativeHandle = isize;
    const WS_CHILD: u32 = 0x4000_0000;
    const WS_VISIBLE: u32 = 0x1000_0000;
    const WS_CLIPSIBLINGS: u32 = 0x0400_0000;
    const SS_BLACKRECT: u32 = 0x0000_0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_SHOWWINDOW: u32 = 0x0040;
    const SWP_ASYNCWINDOWPOS: u32 = 0x4000;
    const LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR: u32 = 0x0000_0100;
    const LOAD_LIBRARY_SEARCH_DEFAULT_DIRS: u32 = 0x0000_1000;

    #[link(name = "user32")]
    extern "system" {
        fn CreateWindowExW(
            ex_style: u32,
            class_name: *const u16,
            window_name: *const u16,
            style: u32,
            x: i32,
            y: i32,
            width: i32,
            height: i32,
            parent: NativeHandle,
            menu: NativeHandle,
            instance: NativeHandle,
            parameter: *const c_void,
        ) -> NativeHandle;
        fn DestroyWindow(window: NativeHandle) -> i32;
        fn ShowWindowAsync(window: NativeHandle, command: i32) -> i32;
        fn SetWindowPos(
            window: NativeHandle,
            insert_after: NativeHandle,
            x: i32,
            y: i32,
            width: i32,
            height: i32,
            flags: u32,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn LoadLibraryExW(file_name: *const u16, file: NativeHandle, flags: u32) -> *mut c_void;
        fn GetProcAddress(module: *mut c_void, name: *const c_char) -> *const c_void;
        fn FreeLibrary(module: *mut c_void) -> i32;
    }

    type MpvCreate = unsafe extern "C" fn() -> *mut c_void;
    type MpvInitialize = unsafe extern "C" fn(*mut c_void) -> c_int;
    type MpvSetOption = unsafe extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int;
    type MpvCommand = unsafe extern "C" fn(*mut c_void, *const *const c_char) -> c_int;
    type MpvGetPropertyString = unsafe extern "C" fn(*mut c_void, *const c_char) -> *mut c_char;
    type MpvFree = unsafe extern "C" fn(*mut c_void);
    type MpvTerminate = unsafe extern "C" fn(*mut c_void);

    type SubclassProc =
        unsafe extern "system" fn(NativeHandle, u32, usize, isize, usize, usize) -> isize;

    #[link(name = "comctl32")]
    extern "system" {
        fn SetWindowSubclass(
            window: NativeHandle,
            callback: SubclassProc,
            id: usize,
            data: usize,
        ) -> i32;
        fn RemoveWindowSubclass(window: NativeHandle, callback: SubclassProc, id: usize) -> i32;
        fn DefSubclassProc(
            window: NativeHandle,
            message: u32,
            wparam: usize,
            lparam: isize,
        ) -> isize;
    }

    struct SurfaceInput {
        app: AppHandle,
        session_id: String,
    }

    #[derive(Clone, Serialize)]
    struct VideoInput<'a> {
        session_id: &'a str,
        action: &'static str,
    }

    // mpv disables its embedded child window. Windows sends that child's mouse
    // input (including promoted touch taps) to this host STATIC window instead.
    // Forward only taps, not a high-frequency mouse-position stream.
    unsafe extern "system" fn surface_input(
        window: NativeHandle,
        message: u32,
        wparam: usize,
        lparam: isize,
        subclass_id: usize,
        data: usize,
    ) -> isize {
        if message == 0x0084 {
            // WM_NCHITTEST: STATIC normally returns HTTRANSPARENT without
            // SS_NOTIFY. Own the video area's input instead of skipping it.
            return 1; // HTCLIENT
        } else if message == 0x0082 {
            // WM_NCDESTROY
            RemoveWindowSubclass(window, surface_input, subclass_id);
            drop(Box::from_raw(data as *mut SurfaceInput));
        } else if message == 0x0202 || (message == 0x0100 && wparam == 0x1b) {
            // WM_LBUTTONUP / WM_KEYDOWN(VK_ESCAPE)
            let input = &*(data as *const SurfaceInput);
            for target in [
                "main".to_string(),
                format!("video-controls-{}", input.session_id),
            ] {
                let _ = input.app.emit_to(
                    target,
                    "embedded-video-input",
                    VideoInput {
                        session_id: &input.session_id,
                        action: if message == 0x0202 {
                            "toggle_controls"
                        } else {
                            "close"
                        },
                    },
                );
            }
            return 0;
        }
        DefSubclassProc(window, message, wparam, lparam)
    }

    pub struct Session {
        id: String,
        surface: NativeHandle,
        commands: mpsc::Sender<PlayerMessage>,
        thread: JoinHandle<()>,
    }

    pub fn find_bundled_library(app: &AppHandle) -> Option<PathBuf> {
        let mut dirs = Vec::new();
        if let Ok(resource_dir) = app.path().resource_dir() {
            dirs.push(resource_dir.join("mpv"));
        }
        if let Ok(executable) = std::env::current_exe() {
            if let Some(parent) = executable.parent() {
                dirs.push(parent.to_path_buf());
                dirs.push(parent.join("mpv"));
            }
        }
        // Development-only location. Release builds use the app resource dir.
        #[cfg(debug_assertions)]
        {
            dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin"));
            dirs.push(
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("bin")
                    .join("mpv"),
            );
        }

        dirs.into_iter()
            .flat_map(|dir| [dir.join("mpv-2.dll"), dir.join("libmpv-2.dll")])
            .find(|path| path.is_file())
    }

    fn physical_bounds(
        app: &AppHandle,
        bounds: VideoBounds,
    ) -> Result<(i32, i32, i32, i32), String> {
        let window = app
            .get_window("main")
            .ok_or_else(|| "Main window not found".to_string())?;
        let scale = window.scale_factor().map_err(|error| error.to_string())?;
        Ok((
            (bounds.x * scale).round() as i32,
            (bounds.y * scale).round() as i32,
            (bounds.width * scale).round().max(1.0) as i32,
            (bounds.height * scale).round().max(1.0) as i32,
        ))
    }

    fn on_main_thread<T: Send + 'static>(
        app: &AppHandle,
        work: impl FnOnce() -> Result<T, String> + Send + 'static,
        abandoned: impl FnOnce(T) + Send + 'static,
    ) -> Result<T, String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            if let Err(mpsc::SendError(Ok(value))) = sender.send(work()) {
                // A late-created surface must not survive a timed-out request.
                abandoned(value);
            }
        })
        .map_err(|error| error.to_string())?;
        receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|error| format!("Video surface did not respond: {error}"))?
    }

    fn create_surface(
        app: &AppHandle,
        bounds: VideoBounds,
        id: &str,
    ) -> Result<NativeHandle, String> {
        let window = app
            .get_window("main")
            .ok_or_else(|| "Main window not found".to_string())?;
        let (x, y, width, height) = physical_bounds(app, bounds)?;
        let input = SurfaceInput {
            app: app.clone(),
            session_id: id.to_string(),
        };
        on_main_thread(
            app,
            move || {
                let parent = window.hwnd().map_err(|error| error.to_string())?.0 as isize;
                let class: Vec<u16> = OsStr::new("STATIC").encode_wide().chain(Some(0)).collect();
                let surface = unsafe {
                    CreateWindowExW(
                        0,
                        class.as_ptr(),
                        std::ptr::null(),
                        WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | SS_BLACKRECT,
                        x,
                        y,
                        width,
                        height,
                        parent,
                        0,
                        0,
                        std::ptr::null(),
                    )
                };
                if surface == 0 {
                    Err(format!(
                        "Could not create native video surface: {}",
                        std::io::Error::last_os_error()
                    ))
                } else {
                    // A newly created native child must be above the main
                    // WebView2 HWND. Later geometry updates preserve this order;
                    // the owned controls window remains above the main window.
                    if unsafe {
                        SetWindowPos(
                            surface,
                            0,
                            x,
                            y,
                            width,
                            height,
                            SWP_NOACTIVATE | SWP_SHOWWINDOW,
                        )
                    } == 0
                    {
                        unsafe {
                            DestroyWindow(surface);
                        }
                        return Err("Could not raise native video surface".into());
                    }
                    let data = Box::into_raw(Box::new(input));
                    if unsafe { SetWindowSubclass(surface, surface_input, 1, data as usize) } == 0 {
                        unsafe {
                            drop(Box::from_raw(data));
                            DestroyWindow(surface);
                        }
                        return Err("Could not attach video input handler".into());
                    }
                    Ok(surface)
                }
            },
            |surface| unsafe {
                DestroyWindow(surface);
            },
        )
    }

    fn destroy_surface(app: &AppHandle, surface: NativeHandle) -> Result<(), String> {
        on_main_thread(
            app,
            move || {
                if unsafe { DestroyWindow(surface) } == 0 {
                    Err(format!(
                        "Could not destroy native video surface: {}",
                        std::io::Error::last_os_error()
                    ))
                } else {
                    Ok(())
                }
            },
            |_| {},
        )
    }

    pub fn open(
        app: &AppHandle,
        sessions: &Arc<Mutex<Option<Session>>>,
        id: String,
        path: PathBuf,
        bounds: VideoBounds,
    ) -> Result<(), String> {
        let library = find_bundled_library(app)
            .ok_or_else(|| "Bundled libmpv DLL was not found".to_string())?;
        let mut guard = sessions.lock().map_err(|error| error.to_string())?;
        if let Some(old) = guard.take() {
            stop_session(app, old)?;
        }

        let surface = create_surface(app, bounds, &id)?;
        let (commands, receiver) = mpsc::channel();
        let (started_tx, started_rx) = mpsc::sync_channel(1);
        let thread =
            thread::spawn(move || player_thread(&library, &path, surface, receiver, started_tx));
        match started_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(())) => {
                *guard = Some(Session {
                    id,
                    surface,
                    commands,
                    thread,
                });
                Ok(())
            }
            Ok(Err(error)) => {
                let _ = stop_session(
                    app,
                    Session {
                        id,
                        surface,
                        commands,
                        thread,
                    },
                );
                Err(error)
            }
            Err(error) => {
                let _ = stop_session(
                    app,
                    Session {
                        id,
                        surface,
                        commands,
                        thread,
                    },
                );
                Err(format!("libmpv did not start: {error}"))
            }
        }
    }

    pub fn resize(
        app: &AppHandle,
        sessions: &Arc<Mutex<Option<Session>>>,
        id: &str,
        bounds: VideoBounds,
    ) -> Result<(), String> {
        let guard = sessions.lock().map_err(|error| error.to_string())?;
        let session = guard
            .as_ref()
            .ok_or_else(|| "Video session is closed".to_string())?;
        if session.id != id {
            return Err("Video session has changed".into());
        }
        let surface = session.surface;
        let (x, y, width, height) = physical_bounds(app, bounds)?;
        // Queue cross-thread geometry changes rather than waiting on mpv's
        // child window procedure from the Tauri UI thread.
        if unsafe {
            SetWindowPos(
                surface,
                0,
                x,
                y,
                width,
                height,
                SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW | SWP_ASYNCWINDOWPOS,
            )
        } == 0
        {
            Err(format!(
                "Could not resize native video surface: {}",
                std::io::Error::last_os_error()
            ))
        } else {
            Ok(())
        }
    }

    pub fn close(
        app: &AppHandle,
        sessions: &Arc<Mutex<Option<Session>>>,
        id: &str,
    ) -> Result<(), String> {
        let mut guard = sessions.lock().map_err(|error| error.to_string())?;
        let session = if guard.as_ref().is_some_and(|session| session.id == id) {
            guard.take()
        } else {
            None
        };
        drop(guard);
        if let Some(session) = session {
            stop_session(app, session)?;
        }
        Ok(())
    }

    pub fn is_current(sessions: &Arc<Mutex<Option<Session>>>, id: &str) -> Result<bool, String> {
        Ok(sessions
            .lock()
            .map_err(|e| e.to_string())?
            .as_ref()
            .is_some_and(|session| session.id == id))
    }

    pub fn control(
        sessions: &Arc<Mutex<Option<Session>>>,
        id: &str,
        action: EmbeddedPlayerAction,
    ) -> Result<(), String> {
        let guard = sessions.lock().map_err(|error| error.to_string())?;
        let session = guard.as_ref().ok_or("Video session is closed")?;
        if session.id != id {
            return Err("Video session has changed".into());
        }
        let (sender, receiver) = mpsc::sync_channel(1);
        session
            .commands
            .send(PlayerMessage::Control(action, sender))
            .map_err(|error| error.to_string())?;
        drop(guard);
        receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|error| error.to_string())?
    }

    pub fn get_state(
        sessions: &Arc<Mutex<Option<Session>>>,
        id: &str,
    ) -> Result<super::EmbeddedVideoPlaybackState, String> {
        let guard = sessions.lock().map_err(|error| error.to_string())?;
        let session = guard.as_ref().ok_or("Video session is closed")?;
        if session.id != id {
            return Err("Video session has changed".into());
        }
        let (sender, receiver) = mpsc::sync_channel(1);
        session
            .commands
            .send(PlayerMessage::GetState(sender))
            .map_err(|error| error.to_string())?;
        drop(guard);
        receiver
            .recv_timeout(Duration::from_millis(500))
            .map_err(|error| error.to_string())?
    }

    fn stop_session(app: &AppHandle, session: Session) -> Result<(), String> {
        if let Some(overlay) = app.get_webview_window(&format!("video-controls-{}", session.id)) {
            let _ = overlay.destroy();
        }
        // Hide immediately. Never join a potentially stalled decoder on the UI
        // thread or while holding the session lock used by control/state IPC.
        unsafe {
            ShowWindowAsync(session.surface, 0);
        }
        let _ = session.commands.send(PlayerMessage::Stop);
        let app = app.clone();
        reap_player(
            session.thread,
            move || destroy_surface(&app, session.surface),
            Duration::from_secs(2),
        )
    }

    fn reap_player(
        worker: JoinHandle<()>,
        cleanup: impl FnOnce() -> Result<(), String> + Send + 'static,
        timeout: Duration,
    ) -> Result<(), String> {
        let (done_tx, done_rx) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let joined = worker.join();
            let destroyed = cleanup();
            let result = joined
                .map_err(|_| "Video worker panicked".to_string())
                .and(destroyed);
            let _ = done_tx.send(result);
        });
        done_rx
            .recv_timeout(timeout)
            .map_err(|error| format!("Video cleanup is still pending: {error}"))?
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn stalled_decoder_does_not_block_close_and_surface_is_cleaned_after_exit() {
            let (release, wait) = mpsc::channel();
            let (cleaned, cleanup_done) = mpsc::channel();
            let worker = thread::spawn(move || {
                wait.recv().unwrap();
            });
            let result = reap_player(
                worker,
                move || {
                    cleaned.send(()).unwrap();
                    Ok(())
                },
                Duration::from_millis(20),
            );
            assert!(result.unwrap_err().contains("cleanup is still pending"));
            assert!(
                cleanup_done.try_recv().is_err(),
                "must not destroy a surface still in use"
            );
            release.send(()).unwrap();
            cleanup_done.recv_timeout(Duration::from_secs(2)).unwrap();
        }

        #[test]
        fn worker_panic_still_cleans_surface_and_reports_failure() {
            let (cleaned, cleanup_done) = mpsc::channel();
            let result = reap_player(
                thread::spawn(|| panic!("simulated decoder failure")),
                move || {
                    cleaned.send(()).unwrap();
                    Ok(())
                },
                Duration::from_secs(2),
            );
            assert_eq!(result.unwrap_err(), "Video worker panicked");
            cleanup_done.recv_timeout(Duration::from_secs(2)).unwrap();
        }
    }

    fn player_thread(
        library: &Path,
        path: &Path,
        surface: NativeHandle,
        commands: mpsc::Receiver<PlayerMessage>,
        started: mpsc::SyncSender<Result<(), String>>,
    ) {
        let result = unsafe { start_player(library, path, surface) };
        match result {
            Ok(player) => {
                let _ = started.send(Ok(()));
                while let Ok(message) = commands.recv() {
                    match message {
                        PlayerMessage::Control(action, reply) => {
                            let _ = reply.send(unsafe { player.control(action) });
                        }
                        PlayerMessage::GetState(reply) => {
                            let _ = reply.send(Ok(player.get_state()));
                        }
                        PlayerMessage::Stop => break,
                    }
                }
                drop(player);
            }
            Err(error) => {
                let _ = started.send(Err(error));
            }
        }
    }

    struct Module(*mut c_void);

    impl Drop for Module {
        fn drop(&mut self) {
            unsafe { FreeLibrary(self.0) };
        }
    }

    struct Player {
        _module: Module,
        handle: *mut c_void,
        terminate: MpvTerminate,
        command: MpvCommand,
        get_property_string: MpvGetPropertyString,
        free: MpvFree,
    }

    impl Player {
        unsafe fn get_prop_str(&self, name: &CStr) -> Option<String> {
            let ptr = (self.get_property_string)(self.handle, name.as_ptr());
            if ptr.is_null() {
                return None;
            }
            let s = CStr::from_ptr(ptr).to_string_lossy().into_owned();
            (self.free)(ptr.cast());
            Some(s)
        }

        pub fn get_state(&self) -> super::EmbeddedVideoPlaybackState {
            let position = unsafe { self.get_prop_str(c"time-pos") }
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            let duration = unsafe { self.get_prop_str(c"duration") }
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            let paused = unsafe { self.get_prop_str(c"pause") }
                .map(|s| s == "yes")
                .unwrap_or(false);
            let volume = unsafe { self.get_prop_str(c"volume") }
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(100.0);
            let muted = unsafe { self.get_prop_str(c"mute") }
                .map(|s| s == "yes")
                .unwrap_or(false);

            super::EmbeddedVideoPlaybackState {
                position,
                duration,
                paused,
                volume,
                muted,
            }
        }

        unsafe fn run_cmd(&self, args: &[*const c_char]) -> Result<(), String> {
            if (self.command)(self.handle, args.as_ptr()) < 0 {
                Err("libmpv rejected the playback command".into())
            } else {
                Ok(())
            }
        }

        unsafe fn control(&self, action: EmbeddedPlayerAction) -> Result<(), String> {
            match action {
                EmbeddedPlayerAction::TogglePause => {
                    let args = [
                        c"cycle".as_ptr(),
                        c"pause".as_ptr(),
                        std::ptr::null(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::Play => {
                    let args = [
                        c"set".as_ptr(),
                        c"pause".as_ptr(),
                        c"no".as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::Pause => {
                    let args = [
                        c"set".as_ptr(),
                        c"pause".as_ptr(),
                        c"yes".as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::SeekBackward => {
                    let args = [
                        c"seek".as_ptr(),
                        c"-10".as_ptr(),
                        c"relative".as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::SeekForward => {
                    let args = [
                        c"seek".as_ptr(),
                        c"10".as_ptr(),
                        c"relative".as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::ToggleMute => {
                    let args = [
                        c"cycle".as_ptr(),
                        c"mute".as_ptr(),
                        std::ptr::null(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::SeekTo(seconds) => {
                    let sec_str =
                        CString::new(format!("{seconds:.2}")).map_err(|e| e.to_string())?;
                    let args = [
                        c"seek".as_ptr(),
                        sec_str.as_ptr(),
                        c"absolute".as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::SeekPercent(percent) => {
                    let pct_str =
                        CString::new(format!("{percent:.2}")).map_err(|e| e.to_string())?;
                    let args = [
                        c"seek".as_ptr(),
                        pct_str.as_ptr(),
                        c"absolute-percent".as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
                EmbeddedPlayerAction::SetVolume(volume) => {
                    let vol_str =
                        CString::new(format!("{volume:.1}")).map_err(|e| e.to_string())?;
                    let args = [
                        c"set".as_ptr(),
                        c"volume".as_ptr(),
                        vol_str.as_ptr(),
                        std::ptr::null(),
                    ];
                    self.run_cmd(&args)
                }
            }
        }
    }

    impl Drop for Player {
        fn drop(&mut self) {
            unsafe { (self.terminate)(self.handle) };
        }
    }

    unsafe fn symbol<T: Copy>(module: *mut c_void, name: &CStr) -> Result<T, String> {
        let pointer = GetProcAddress(module, name.as_ptr());
        if pointer.is_null() {
            return Err(format!("libmpv is missing {}", name.to_string_lossy()));
        }
        Ok(std::mem::transmute_copy(&pointer))
    }

    unsafe fn start_player(
        library: &Path,
        path: &Path,
        surface: NativeHandle,
    ) -> Result<Player, String> {
        let wide: Vec<u16> = library.as_os_str().encode_wide().chain(Some(0)).collect();
        let module = LoadLibraryExW(
            wide.as_ptr(),
            0,
            LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS,
        );
        if module.is_null() {
            return Err(format!(
                "Could not load bundled libmpv: {}",
                std::io::Error::last_os_error()
            ));
        }
        let module = Module(module);
        let create: MpvCreate = symbol(module.0, c"mpv_create")?;
        let initialize: MpvInitialize = symbol(module.0, c"mpv_initialize")?;
        let set_option: MpvSetOption = symbol(module.0, c"mpv_set_option_string")?;
        let command: MpvCommand = symbol(module.0, c"mpv_command")?;
        let get_property_string: MpvGetPropertyString =
            symbol(module.0, c"mpv_get_property_string")?;
        let free: MpvFree = symbol(module.0, c"mpv_free")?;
        let terminate: MpvTerminate = symbol(module.0, c"mpv_terminate_destroy")?;
        let handle = create();
        if handle.is_null() {
            return Err("libmpv could not create a player".into());
        }
        let player = Player {
            _module: module,
            handle,
            terminate,
            command,
            get_property_string,
            free,
        };
        for (name, value) in [
            (c"wid", (surface as usize).to_string()),
            (c"vo", "gpu".into()),
            (c"gpu-context", "d3d11".into()),
            (c"hwdec", "auto-safe".into()),
            (c"input-default-bindings", "no".into()),
            (c"input-vo-keyboard", "no".into()),
            (c"osc", "no".into()),
        ] {
            let value = CString::new(value).map_err(|error| error.to_string())?;
            if set_option(handle, name.as_ptr(), value.as_ptr()) < 0 {
                return Err(format!("libmpv rejected {}", name.to_string_lossy()));
            }
        }
        if initialize(handle) < 0 {
            return Err("libmpv could not initialize".into());
        }
        let file =
            CString::new(path.to_string_lossy().as_bytes()).map_err(|error| error.to_string())?;
        let arguments = [
            c"loadfile".as_ptr(),
            file.as_ptr(),
            c"replace".as_ptr(),
            std::ptr::null(),
        ];
        if command(handle, arguments.as_ptr()) < 0 {
            return Err("libmpv could not open the video".into());
        }
        Ok(player)
    }
}
