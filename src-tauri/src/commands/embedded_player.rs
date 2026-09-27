use serde::{Deserialize, Serialize};
use std::path::Path;
#[cfg(any(windows, target_os = "macos"))]
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

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

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmbeddedPlayerAction {
    TogglePause,
    SeekBackward,
    SeekForward,
}

#[cfg(any(windows, target_os = "macos"))]
pub enum PlayerMessage {
    Control(
        EmbeddedPlayerAction,
        std::sync::mpsc::SyncSender<Result<(), String>>,
    ),
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

#[cfg(windows)]
mod windows_player {
    use super::{EmbeddedPlayerAction, PlayerMessage, VideoBounds};
    use std::ffi::{c_char, c_int, c_void, CStr, CString, OsStr};
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::sync::{mpsc, Arc, Mutex};
    use std::thread::{self, JoinHandle};
    use std::time::Duration;
    use tauri::{AppHandle, Manager};

    type NativeHandle = isize;
    const WS_CHILD: u32 = 0x4000_0000;
    const WS_VISIBLE: u32 = 0x1000_0000;
    const WS_CLIPSIBLINGS: u32 = 0x0400_0000;
    const SS_BLACKRECT: u32 = 0x0000_0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_SHOWWINDOW: u32 = 0x0040;
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
    type MpvTerminate = unsafe extern "C" fn(*mut c_void);

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
            dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin").join("mpv"));
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
    ) -> Result<T, String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            let _ = sender.send(work());
        })
        .map_err(|error| error.to_string())?;
        receiver
            .recv()
            .map_err(|error| format!("Video surface did not respond: {error}"))?
    }

    fn create_surface(app: &AppHandle, bounds: VideoBounds) -> Result<NativeHandle, String> {
        let window = app
            .get_window("main")
            .ok_or_else(|| "Main window not found".to_string())?;
        let (x, y, width, height) = physical_bounds(app, bounds)?;
        on_main_thread(app, move || {
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
                Ok(surface)
            }
        })
    }

    fn destroy_surface(app: &AppHandle, surface: NativeHandle) -> Result<(), String> {
        on_main_thread(app, move || {
            if unsafe { DestroyWindow(surface) } == 0 {
                Err(format!(
                    "Could not destroy native video surface: {}",
                    std::io::Error::last_os_error()
                ))
            } else {
                Ok(())
            }
        })
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

        let surface = create_surface(app, bounds)?;
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
                let _ = commands.send(PlayerMessage::Stop);
                let _ = thread.join();
                let _ = destroy_surface(app, surface);
                Err(error)
            }
            Err(error) => {
                let _ = commands.send(PlayerMessage::Stop);
                let app = app.clone();
                thread::spawn(move || {
                    let _ = thread.join();
                    let _ = destroy_surface(&app, surface);
                });
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
        on_main_thread(app, move || {
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
                Err(format!(
                    "Could not resize native video surface: {}",
                    std::io::Error::last_os_error()
                ))
            } else {
                Ok(())
            }
        })
    }

    pub fn close(
        app: &AppHandle,
        sessions: &Arc<Mutex<Option<Session>>>,
        id: &str,
    ) -> Result<(), String> {
        let mut guard = sessions.lock().map_err(|error| error.to_string())?;
        if guard.as_ref().is_some_and(|session| session.id == id) {
            if let Some(session) = guard.take() {
                stop_session(app, session)?;
            }
        }
        Ok(())
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
        receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|error| error.to_string())?
    }

    fn stop_session(app: &AppHandle, session: Session) -> Result<(), String> {
        let _ = session.commands.send(PlayerMessage::Stop);
        let _ = session.thread.join();
        destroy_surface(app, session.surface)
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
    }

    impl Player {
        unsafe fn control(&self, action: EmbeddedPlayerAction) -> Result<(), String> {
            let arguments: [*const c_char; 4] = match action {
                EmbeddedPlayerAction::TogglePause => [
                    c"cycle".as_ptr(),
                    c"pause".as_ptr(),
                    std::ptr::null(),
                    std::ptr::null(),
                ],
                EmbeddedPlayerAction::SeekBackward => [
                    c"seek".as_ptr(),
                    c"-10".as_ptr(),
                    c"relative".as_ptr(),
                    std::ptr::null(),
                ],
                EmbeddedPlayerAction::SeekForward => [
                    c"seek".as_ptr(),
                    c"10".as_ptr(),
                    c"relative".as_ptr(),
                    std::ptr::null(),
                ],
            };
            if (self.command)(self.handle, arguments.as_ptr()) < 0 {
                Err("libmpv rejected the playback command".into())
            } else {
                Ok(())
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
        };
        for (name, value) in [
            (c"wid", (surface as usize).to_string()),
            (c"vo", "gpu".into()),
            (c"gpu-context", "d3d11".into()),
            (c"hwdec", "auto-safe".into()),
            (c"input-default-bindings", "yes".into()),
            (c"osc", "yes".into()),
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
