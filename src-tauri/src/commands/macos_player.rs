use super::embedded_player::{EmbeddedPlayerAction, PlayerMessage, VideoBounds};
use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const RTLD_NOW: c_int = 2;
const RTLD_LOCAL: c_int = 4;
const MPV_FORMAT_INT64: c_int = 4;

extern "C" {
    fn dlopen(path: *const c_char, mode: c_int) -> *mut c_void;
    fn dlsym(module: *mut c_void, name: *const c_char) -> *mut c_void;
    fn dlclose(module: *mut c_void) -> c_int;
    fn dlerror() -> *const c_char;

    fn novus_mpv_create_view(
        parent: *mut c_void,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> *mut c_void;
    fn novus_mpv_resize_view(surface: *mut c_void, x: f64, y: f64, width: f64, height: f64);
    fn novus_mpv_destroy_view(surface: *mut c_void);
}

type MpvCreate = unsafe extern "C" fn() -> *mut c_void;
type MpvInitialize = unsafe extern "C" fn(*mut c_void) -> c_int;
type MpvSetOption = unsafe extern "C" fn(*mut c_void, *const c_char, c_int, *const c_void) -> c_int;
type MpvSetOptionString = unsafe extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int;
type MpvCommand = unsafe extern "C" fn(*mut c_void, *const *const c_char) -> c_int;
type MpvWaitEvent = unsafe extern "C" fn(*mut c_void, f64) -> *const MpvEvent;
type MpvTerminate = unsafe extern "C" fn(*mut c_void);

#[repr(C)]
struct MpvEvent {
    event_id: c_int,
    error: c_int,
    reply_userdata: u64,
    data: *mut c_void,
}

#[repr(C)]
struct MpvEndFile {
    reason: c_int,
    error: c_int,
}

pub struct Session {
    id: String,
    surface: usize,
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
            if let Some(contents) = parent.parent() {
                dirs.push(contents.join("Frameworks"));
                dirs.push(contents.join("Frameworks/mpv"));
            }
        }
    }
    #[cfg(debug_assertions)]
    {
        dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin"));
        dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin").join("mpv"));
    }

    dirs.into_iter()
        .flat_map(|dir| [dir.join("libmpv.dylib"), dir.join("libmpv.2.dylib")])
        .find(|path| path.is_file())
}

pub fn library_available(app: &AppHandle) -> bool {
    static AVAILABLE: OnceLock<bool> = OnceLock::new();
    *AVAILABLE.get_or_init(|| {
        find_bundled_library(app)
            .and_then(|path| unsafe { Module::open(&path).ok() })
            .is_some_and(|module| unsafe {
                [
                    c"mpv_create",
                    c"mpv_initialize",
                    c"mpv_set_option",
                    c"mpv_set_option_string",
                    c"mpv_command",
                    c"mpv_wait_event",
                    c"mpv_terminate_destroy",
                ]
                .iter()
                .all(|name| !dlsym(module.0, name.as_ptr()).is_null())
            })
    })
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

fn create_surface(app: &AppHandle, bounds: VideoBounds) -> Result<usize, String> {
    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    on_main_thread(app, move || {
        let parent = window.ns_view().map_err(|error| error.to_string())?;
        let surface = unsafe {
            novus_mpv_create_view(parent, bounds.x, bounds.y, bounds.width, bounds.height)
        };
        if surface.is_null() {
            Err("Could not create macOS video surface".into())
        } else {
            Ok(surface as usize)
        }
    })
}

fn destroy_surface(app: &AppHandle, surface: usize) -> Result<(), String> {
    on_main_thread(app, move || {
        unsafe { novus_mpv_destroy_view(surface as *mut c_void) };
        Ok(())
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
        .ok_or_else(|| "Bundled libmpv dylib was not found".to_string())?;
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
    on_main_thread(app, move || {
        unsafe {
            novus_mpv_resize_view(
                surface as *mut c_void,
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
            )
        };
        Ok(())
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
    surface: usize,
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

impl Module {
    unsafe fn open(path: &Path) -> Result<Self, String> {
        let path =
            CString::new(path.to_string_lossy().as_bytes()).map_err(|error| error.to_string())?;
        let module = dlopen(path.as_ptr(), RTLD_NOW | RTLD_LOCAL);
        if module.is_null() {
            let error = dlerror();
            let detail = if error.is_null() {
                "Unknown dynamic loader error".to_string()
            } else {
                CStr::from_ptr(error).to_string_lossy().into_owned()
            };
            Err(format!("Could not load bundled libmpv: {detail}"))
        } else {
            Ok(Self(module))
        }
    }

    unsafe fn symbol<T: Copy>(&self, name: &CStr) -> Result<T, String> {
        let pointer = dlsym(self.0, name.as_ptr());
        if pointer.is_null() {
            return Err(format!("libmpv is missing {}", name.to_string_lossy()));
        }
        Ok(std::mem::transmute_copy(&pointer))
    }
}

impl Drop for Module {
    fn drop(&mut self) {
        unsafe { dlclose(self.0) };
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

unsafe fn start_player(library: &Path, path: &Path, surface: usize) -> Result<Player, String> {
    let module = Module::open(library)?;
    let create: MpvCreate = module.symbol(c"mpv_create")?;
    let initialize: MpvInitialize = module.symbol(c"mpv_initialize")?;
    let set_option: MpvSetOption = module.symbol(c"mpv_set_option")?;
    let set_option_string: MpvSetOptionString = module.symbol(c"mpv_set_option_string")?;
    let command: MpvCommand = module.symbol(c"mpv_command")?;
    let wait_event: MpvWaitEvent = module.symbol(c"mpv_wait_event")?;
    let terminate: MpvTerminate = module.symbol(c"mpv_terminate_destroy")?;
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
    let wid = surface as i64;
    if set_option(
        handle,
        c"wid".as_ptr(),
        MPV_FORMAT_INT64,
        (&wid as *const i64).cast(),
    ) < 0
    {
        return Err("libmpv rejected the macOS video view".into());
    }
    for (name, value) in [
        (c"hwdec", c"auto-safe"),
        (c"input-default-bindings", c"yes"),
        (c"osc", c"yes"),
    ] {
        if set_option_string(handle, name.as_ptr(), value.as_ptr()) < 0 {
            return Err(format!("libmpv rejected {}", name.to_string_lossy()));
        }
    }
    if initialize(handle) < 0 {
        return Err("libmpv could not initialize".into());
    }
    let file = CString::new(path.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
    let arguments = [c"loadfile".as_ptr(), file.as_ptr(), std::ptr::null()];
    if command(handle, arguments.as_ptr()) < 0 {
        return Err("libmpv could not open the video".into());
    }
    let deadline = Instant::now() + Duration::from_secs(8);
    while Instant::now() < deadline {
        let event = wait_event(handle, 0.5);
        if event.is_null() {
            return Err("libmpv did not return a playback event".into());
        }
        match (*event).event_id {
            8 => return Ok(player), // MPV_EVENT_FILE_LOADED
            7 => {
                let end = (*event).data.cast::<MpvEndFile>();
                let detail = if end.is_null() {
                    (*event).error
                } else {
                    (*end).error
                };
                return Err(format!("libmpv stopped before the video loaded ({detail})"));
            }
            1 => return Err("libmpv shut down before the video loaded".into()),
            _ => {}
        }
    }
    Err("libmpv timed out while loading the video".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_library_or_staged_dylib_is_found_and_valid() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let candidate = manifest_dir.join("bin").join("mpv").join("libmpv.2.dylib");
        if candidate.is_file() {
            let module = unsafe { Module::open(&candidate) };
            assert!(module.is_ok(), "Failed to dlopen staged libmpv.2.dylib");
            let module = module.unwrap();
            let has_symbols = unsafe {
                [
                    c"mpv_create",
                    c"mpv_initialize",
                    c"mpv_set_option",
                    c"mpv_set_option_string",
                    c"mpv_command",
                    c"mpv_wait_event",
                    c"mpv_terminate_destroy",
                ]
                .iter()
                .all(|name| !dlsym(module.0, name.as_ptr()).is_null())
            };
            assert!(has_symbols, "staged libmpv is missing required symbols");
        }
    }
}
