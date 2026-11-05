use super::{failure, Phase, Result, UpdateFailure, UpdateStatus, EVENT};
use reqwest::{redirect::Policy, Client, ClientBuilder};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};
use tempfile::TempPath;
use tokio::{io::AsyncWriteExt, sync::watch};

const ENDPOINT: &str = "https://github.com/HYS1753/novus/releases/latest/download/latest.json";
const KEY: &str = include_str!("../../../signing/updater.pub");
const MAX_BYTES: u64 = 128 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);

struct Inner {
    status: UpdateStatus,
    generation: u64,
    pending: Option<Update>,
    cached: Option<TempPath>,
}
pub struct UpdaterState {
    inner: Mutex<Inner>,
    cancellation: watch::Sender<u64>,
}
impl Default for UpdaterState {
    fn default() -> Self {
        let (cancellation, _) = watch::channel(0);
        Self {
            inner: Mutex::new(Inner {
                status: UpdateStatus::new(super::SUPPORTED && is_nsis_install()),
                generation: 0,
                pending: None,
                cached: None,
            }),
            cancellation,
        }
    }
}
fn is_nsis_install() -> bool {
    !cfg!(debug_assertions)
        && tauri::utils::platform::bundle_type() == Some(tauri::utils::config::BundleType::Nsis)
        && std::env::current_exe()
            .ok()
            .and_then(|path| {
                path.parent()
                    .map(|parent| parent.join("uninstall.exe").is_file())
            })
            .unwrap_or(false)
}
impl UpdaterState {
    fn lock(&self) -> Result<MutexGuard<'_, Inner>> {
        self.inner
            .lock()
            .map_err(|_| failure("internal", "업데이트 상태를 읽지 못했습니다."))
    }
    pub fn snapshot(&self) -> Result<UpdateStatus> {
        Ok(self.lock()?.status.clone())
    }
    fn begin(
        &self,
        phase: Phase,
        expected: Option<&str>,
    ) -> Result<(u64, watch::Receiver<u64>, Option<Update>)> {
        let mut inner = self.lock()?;
        if matches!(
            inner.status.phase,
            Phase::Checking | Phase::Downloading | Phase::Installing
        ) {
            return Err(failure("busy", "업데이트 작업이 이미 진행 중입니다."));
        }
        if phase == Phase::Downloading
            && (inner.status.phase != Phase::Available
                || inner.status.available_version.as_deref() != expected
                || inner.pending.is_none())
        {
            return Err(failure(
                "stale_update",
                "업데이트 정보를 다시 확인해 주세요.",
            ));
        }
        if phase == Phase::Checking {
            inner.pending = None;
            inner.cached = None;
            inner.status.available_version = None;
            inner.status.notes = None;
        }
        inner.generation += 1;
        self.cancellation.send_replace(inner.generation);
        inner.status.phase = phase;
        inner.status.downloaded_bytes = 0;
        inner.status.total_bytes = None;
        inner.status.error = None;
        inner.status.revision += 1;
        Ok((
            inner.generation,
            self.cancellation.subscribe(),
            inner.pending.clone(),
        ))
    }
    fn finish<R: tauri::Runtime>(
        &self,
        app: &AppHandle<R>,
        generation: u64,
        result: Result<Completion>,
    ) -> Result<UpdateStatus> {
        let mut inner = self.lock()?;
        if inner.generation != generation {
            return Err(cancelled());
        }
        let error = match result {
            Ok(Completion::Checked(update)) => {
                inner.status.phase = if update.is_some() {
                    Phase::Available
                } else {
                    Phase::UpToDate
                };
                inner.status.available_version =
                    update.as_ref().map(|update| update.version.clone());
                inner.status.notes = update.as_ref().and_then(|update| update.body.clone());
                inner.pending = update;
                None
            }
            Ok(Completion::Downloaded(path, length)) => {
                inner.cached = Some(path);
                inner.status.phase = Phase::Ready;
                inner.status.downloaded_bytes = length;
                inner.status.total_bytes = Some(length);
                None
            }
            Err(error) => {
                inner.pending = None;
                inner.cached = None;
                inner.status.phase = Phase::Error;
                inner.status.error = Some(error.clone());
                Some(error)
            }
        };
        inner.status.revision += 1;
        let snapshot = inner.status.clone();
        drop(inner);
        let _ = app.emit_to("main", EVENT, &snapshot);
        if let Some(error) = error {
            Err(error)
        } else {
            Ok(snapshot)
        }
    }
}
enum Completion {
    Checked(Option<Update>),
    Downloaded(TempPath, u64),
}
fn cancelled() -> UpdateFailure {
    failure("cancelled", "업데이트 작업을 취소했습니다.")
}
async fn cancellable<T>(
    cancel: &mut watch::Receiver<u64>,
    operation: impl std::future::Future<Output = Result<T>>,
) -> Result<T> {
    tokio::select! { biased; _ = cancel.changed() => Err(cancelled()), result = operation => result }
}
fn io_error(_: std::io::Error) -> UpdateFailure {
    failure(
        "storage",
        "업데이트 임시 파일을 읽거나 저장하지 못했습니다.",
    )
}
fn network_error(error: reqwest::Error) -> UpdateFailure {
    if error.is_timeout() {
        failure("timeout", "업데이트 서버 응답 시간이 초과되었습니다.")
    } else {
        failure("network", "업데이트 서버에 연결하지 못했습니다.")
    }
}
fn plugin_error(error: tauri_plugin_updater::Error) -> UpdateFailure {
    use tauri_plugin_updater::Error;
    match error {
        Error::Reqwest(error) => network_error(error),
        Error::ReleaseNotFound => failure(
            "release_unavailable",
            "공개된 업데이트 정보를 찾지 못했습니다.",
        ),
        Error::Minisign(_)
        | Error::Base64(_)
        | Error::SignatureUtf8(_)
        | Error::SignedVersionMismatch { .. }
        | Error::MissingSignedVersion => failure(
            "signature",
            "업데이트 파일의 서명 또는 서명된 버전이 올바르지 않습니다.",
        ),
        Error::Serialization(_)
        | Error::Semver(_)
        | Error::TargetNotFound(_)
        | Error::TargetsNotFound(_) => failure(
            "invalid_release",
            "업데이트 정보 형식이나 플랫폼이 올바르지 않습니다.",
        ),
        _ => failure("updater", "업데이트 작업을 완료하지 못했습니다."),
    }
}
fn secure_client(builder: ClientBuilder) -> ClientBuilder {
    builder
        .user_agent(concat!("Novus/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(10))
        .redirect(Policy::custom(|attempt| {
            if attempt.url().scheme() != "https" || attempt.previous().len() > 5 {
                attempt.error("Insecure or excessive updater redirect")
            } else {
                attempt.follow()
            }
        }))
}
fn validate_update(update: &Update) -> Result<()> {
    let version = semver::Version::parse(&update.version)
        .map_err(|_| failure("invalid_release", "업데이트 버전 형식이 올바르지 않습니다."))?;
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))
        .map_err(|_| failure("configuration", "앱 버전 설정이 올바르지 않습니다."))?;
    let expected = format!("https://github.com/HYS1753/novus/releases/download/v{version}/novus_{version}_x64-setup.exe");
    if !version.pre.is_empty()
        || !version.build.is_empty()
        || version <= current
        || [version.major, version.minor, version.patch]
            .iter()
            .any(|part| *part > 65535)
        || update.download_url.as_str() != expected
    {
        return Err(failure(
            "invalid_release",
            "허용된 정식 버전의 Windows 설치 파일이 아닙니다.",
        ));
    }
    Ok(())
}
async fn check_remote<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<Completion> {
    let raw = app
        .config()
        .plugins
        .0
        .get("updater")
        .ok_or_else(|| failure("configuration", "업데이트 설정이 없습니다."))?;
    let config: tauri_plugin_updater::Config = serde_json::from_value(raw.clone())
        .map_err(|_| failure("configuration", "업데이트 설정이 올바르지 않습니다."))?;
    if config.pubkey.trim() != KEY.trim()
        || !config.require_signed_version
        || config.allow_downgrades
        || config.dangerous_insecure_transport_protocol
        || config.dangerous_accept_invalid_certs
        || config.dangerous_accept_invalid_hostnames
        || !config.windows.as_ref().is_some_and(|windows| {
            windows.installer_args.is_empty() && windows.install_mode.to_string() == "passive"
        })
        || config.endpoints.len() != 1
        || config.endpoints[0].as_str() != ENDPOINT
    {
        return Err(failure(
            "configuration",
            "안전한 업데이트 설정이 필요합니다.",
        ));
    }
    let updater = app
        .updater_builder()
        .target("windows-x86_64")
        .timeout(Duration::from_secs(15))
        .configure_client(secure_client)
        .build()
        .map_err(plugin_error)?;
    let client = secure_client(Client::builder())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(network_error)?;
    let mut update = match fetch_manifest(&client, ENDPOINT).await? {
        Some(raw) => updater.restore_update(raw).map_err(plugin_error)?,
        None => None,
    };
    if let Some(update) = &mut update {
        validate_update(update)?;
        update.body = update
            .body
            .as_ref()
            .map(|notes| notes.chars().take(2048).collect());
    }
    Ok(Completion::Checked(update))
}

async fn fetch_manifest(client: &Client, endpoint: &str) -> Result<Option<serde_json::Value>> {
    let mut response = client
        .get(endpoint)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(network_error)?;
    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(None);
    }
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(failure(
            "release_unavailable",
            "공개된 업데이트 정보를 찾지 못했습니다.",
        ));
    }
    response = response.error_for_status().map_err(network_error)?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_MANIFEST_BYTES)
    {
        return Err(failure(
            "too_large",
            "업데이트 정보 크기 제한을 초과했습니다.",
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(network_error)? {
        if bytes.len() as u64 + chunk.len() as u64 > MAX_MANIFEST_BYTES {
            return Err(failure(
                "too_large",
                "업데이트 정보 크기 제한을 초과했습니다.",
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| failure("invalid_release", "업데이트 정보 형식이 올바르지 않습니다."))
}
pub async fn check<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &UpdaterState,
) -> Result<UpdateStatus> {
    let (generation, mut cancel, _) = state.begin(Phase::Checking, None)?;
    let _ = app.emit_to("main", EVENT, state.snapshot()?);
    let result = cancellable(&mut cancel, check_remote(app)).await;
    state.finish(app, generation, result)
}

fn read_verified(update: &Update, path: &Path) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(io_error)?
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error)?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err(failure(
            "too_large",
            "업데이트 파일 크기 제한을 초과했습니다.",
        ));
    }
    update.verify(&bytes).map_err(plugin_error)?;
    if bytes.len() < 64 || !bytes.starts_with(b"MZ") {
        return Err(failure(
            "invalid_release",
            "Windows 설치 파일 형식이 아닙니다.",
        ));
    }
    Ok(bytes)
}
async fn download_package(
    update: &Update,
    client: &Client,
    directory: &Path,
    mut progress: impl FnMut(u64, Option<u64>),
) -> Result<(TempPath, u64)> {
    let mut response = client
        .get(update.download_url.clone())
        .send()
        .await
        .map_err(network_error)?
        .error_for_status()
        .map_err(network_error)?;
    let total = response.content_length();
    if total.is_some_and(|length| length > MAX_BYTES) {
        return Err(failure(
            "too_large",
            "업데이트 파일 크기 제한을 초과했습니다.",
        ));
    }
    let path = tempfile::Builder::new()
        .prefix("novus-update-")
        .suffix(".exe")
        .tempfile_in(directory)
        .map_err(io_error)?
        .into_temp_path();
    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .await
        .map_err(io_error)?;
    let mut length = 0u64;
    while let Some(chunk) = response.chunk().await.map_err(network_error)? {
        length = length.saturating_add(chunk.len() as u64);
        if length > MAX_BYTES {
            return Err(failure(
                "too_large",
                "업데이트 파일 크기 제한을 초과했습니다.",
            ));
        }
        file.write_all(&chunk).await.map_err(io_error)?;
        progress(length, total);
    }
    file.flush().await.map_err(io_error)?;
    drop(file);
    let verifier = update.clone();
    tauri::async_runtime::spawn_blocking(move || {
        read_verified(&verifier, &path)?;
        Ok((path, length))
    })
    .await
    .map_err(|_| failure("internal", "업데이트 검증 작업을 완료하지 못했습니다."))?
}
fn cache_directory<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|_| failure("storage", "업데이트 캐시 경로를 찾지 못했습니다."))?
        .join("updates");
    fs::create_dir_all(&directory).map_err(io_error)?;
    // Only our private temporary files are pruned, never user data or installer files.
    for entry in fs::read_dir(&directory)
        .map_err(io_error)?
        .flatten()
        .take(64)
    {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("novus-update-") && name.ends_with(".exe") {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(directory)
}
pub async fn download<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &UpdaterState,
    expected: &str,
) -> Result<UpdateStatus> {
    let (generation, mut cancel, update) = state.begin(Phase::Downloading, Some(expected))?;
    let _ = app.emit_to("main", EVENT, state.snapshot()?);
    let operation = async {
        let update =
            update.ok_or_else(|| failure("stale_update", "업데이트 정보를 다시 확인해 주세요."))?;
        validate_update(&update)?;
        let directory = cache_directory(app)?;
        let client = secure_client(Client::builder())
            .timeout(DOWNLOAD_TIMEOUT)
            .build()
            .map_err(network_error)?;
        let mut last = Instant::now();
        let (path, length) = download_package(&update, &client, &directory, |length, total| {
            if last.elapsed() < Duration::from_millis(250) {
                return;
            }
            last = Instant::now();
            if let Ok(mut inner) = state.lock() {
                if inner.generation != generation {
                    return;
                }
                inner.status.downloaded_bytes = length;
                inner.status.total_bytes = total;
                inner.status.revision += 1;
                let snapshot = inner.status.clone();
                drop(inner);
                let _ = app.emit_to("main", EVENT, snapshot);
            }
        })
        .await?;
        Ok(Completion::Downloaded(path, length))
    };
    let result = cancellable(&mut cancel, operation).await;
    state.finish(app, generation, result)
}
pub fn cancel<R: tauri::Runtime>(app: &AppHandle<R>, state: &UpdaterState) -> Result<UpdateStatus> {
    let mut inner = state.lock()?;
    if inner.status.phase == Phase::Installing {
        return Err(failure("busy", "설치 시작 후에는 취소할 수 없습니다."));
    }
    inner.generation += 1;
    state.cancellation.send_replace(inner.generation);
    let revision = inner.status.revision + 1;
    inner.status = UpdateStatus::new(inner.status.can_install);
    inner.status.revision = revision;
    inner.pending = None;
    inner.cached = None;
    let snapshot = inner.status.clone();
    drop(inner);
    let _ = app.emit_to("main", EVENT, &snapshot);
    Ok(snapshot)
}
pub async fn install<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &UpdaterState,
    expected: &str,
) -> Result<UpdateStatus> {
    let (generation, update, path) = {
        let mut inner = state.lock()?;
        if !inner.status.can_install || !is_nsis_install() {
            return Err(failure(
                "installation_required",
                "정식 NSIS 설치본에서만 업데이트를 설치할 수 있습니다.",
            ));
        }
        if inner.status.phase != Phase::Ready
            || inner.status.available_version.as_deref() != Some(expected)
        {
            return Err(failure(
                "stale_update",
                "검증된 업데이트를 다시 준비해 주세요.",
            ));
        }
        let update = inner
            .pending
            .clone()
            .ok_or_else(|| failure("stale_update", "업데이트 정보가 없습니다."))?;
        let path = inner
            .cached
            .take()
            .ok_or_else(|| failure("stale_update", "업데이트 파일이 없습니다."))?;
        inner.generation += 1;
        inner.status.phase = Phase::Installing;
        inner.status.revision += 1;
        (inner.generation, update, path)
    };
    let _ = app.emit_to("main", EVENT, state.snapshot()?);
    let result = tauri::async_runtime::spawn_blocking(move || {
        validate_update(&update)?;
        let bytes = read_verified(&update, &path)?;
        let _ = fs::remove_file(&path);
        update.install(bytes).map_err(plugin_error)
    })
    .await
    .map_err(|_| failure("internal", "설치 작업을 완료하지 못했습니다."))
    .and_then(|result| result);
    // On Windows a successful install launches NSIS and exits this process.
    let error = result
        .err()
        .unwrap_or_else(|| failure("updater", "설치 프로그램이 앱 종료 없이 반환되었습니다."));
    state.finish(app, generation, Err(error))
}

#[cfg(test)]
mod tests;
