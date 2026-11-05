use serde::Serialize;
use tauri::{AppHandle, State, Webview};

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::UpdaterState;
#[cfg(not(windows))]
#[derive(Default)]
pub struct UpdaterState;

pub const EVENT: &str = "novus-update-state";
pub const SUPPORTED: bool = cfg!(all(target_os = "windows", target_arch = "x86_64"));

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Unsupported,
    Idle,
    Checking,
    UpToDate,
    Available,
    Downloading,
    Ready,
    Installing,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFailure {
    pub code: &'static str,
    pub message: &'static str,
}
pub type Result<T> = std::result::Result<T, UpdateFailure>;
pub fn failure(code: &'static str, message: &'static str) -> UpdateFailure {
    UpdateFailure { code, message }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub supported: bool,
    pub can_install: bool,
    pub phase: Phase,
    pub current_version: &'static str,
    pub available_version: Option<String>,
    pub notes: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub error: Option<UpdateFailure>,
    pub revision: u64,
}
impl UpdateStatus {
    pub fn new(can_install: bool) -> Self {
        Self {
            supported: SUPPORTED,
            can_install,
            phase: if SUPPORTED {
                Phase::Idle
            } else {
                Phase::Unsupported
            },
            current_version: env!("CARGO_PKG_VERSION"),
            available_version: None,
            notes: None,
            downloaded_bytes: 0,
            total_bytes: None,
            error: None,
            revision: 0,
        }
    }
}
fn authorize(label: &str) -> Result<()> {
    if label != "main" {
        return Err(failure(
            "forbidden",
            "메인 화면에서만 업데이트를 조작할 수 있습니다.",
        ));
    }
    if !SUPPORTED {
        return Err(failure(
            "unsupported",
            "현재는 Windows x64 업데이트만 지원합니다.",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn get_update_state<R: tauri::Runtime>(
    webview: Webview<R>,
    state: State<'_, UpdaterState>,
) -> Result<UpdateStatus> {
    if webview.label() != "main" {
        return Err(failure(
            "forbidden",
            "메인 화면에서만 업데이트 상태를 조회할 수 있습니다.",
        ));
    }
    #[cfg(windows)]
    {
        state.snapshot()
    }
    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(UpdateStatus::new(false))
    }
}

#[tauri::command]
pub async fn check_for_update<R: tauri::Runtime>(
    webview: Webview<R>,
    app: AppHandle<R>,
    state: State<'_, UpdaterState>,
) -> Result<UpdateStatus> {
    authorize(webview.label())?;
    #[cfg(windows)]
    {
        windows::check(&app, &state).await
    }
    #[cfg(not(windows))]
    {
        let _ = (app, state);
        unreachable!()
    }
}

#[tauri::command]
pub async fn download_update<R: tauri::Runtime>(
    webview: Webview<R>,
    app: AppHandle<R>,
    state: State<'_, UpdaterState>,
    expected_version: String,
) -> Result<UpdateStatus> {
    authorize(webview.label())?;
    #[cfg(windows)]
    {
        windows::download(&app, &state, &expected_version).await
    }
    #[cfg(not(windows))]
    {
        let _ = (app, state, expected_version);
        unreachable!()
    }
}

#[tauri::command]
pub async fn install_update<R: tauri::Runtime>(
    webview: Webview<R>,
    app: AppHandle<R>,
    state: State<'_, UpdaterState>,
    expected_version: String,
) -> Result<UpdateStatus> {
    authorize(webview.label())?;
    #[cfg(windows)]
    {
        windows::install(&app, &state, &expected_version).await
    }
    #[cfg(not(windows))]
    {
        let _ = (app, state, expected_version);
        unreachable!()
    }
}

#[tauri::command]
pub fn cancel_update<R: tauri::Runtime>(
    webview: Webview<R>,
    app: AppHandle<R>,
    state: State<'_, UpdaterState>,
) -> Result<UpdateStatus> {
    authorize(webview.label())?;
    #[cfg(windows)]
    {
        windows::cancel(&app, &state)
    }
    #[cfg(not(windows))]
    {
        let _ = (app, state);
        unreachable!()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn remote_and_overlay_webviews_cannot_control_updater() {
        for label in ["youtube", "streaming-youtube", "video-controls-1", ""] {
            assert_eq!(authorize(label).unwrap_err().code, "forbidden");
        }
    }
}
