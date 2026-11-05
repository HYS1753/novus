use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
};

struct SigningFixture {
    directory: tempfile::TempDir,
    payload: Vec<u8>,
    signature: String,
    public_key: String,
    version: String,
}
impl SigningFixture {
    fn new() -> Self {
        let directory = tempfile::tempdir().unwrap();
        let key = directory.path().join("disposable.key");
        let mut next: semver::Version = env!("CARGO_PKG_VERSION").parse().unwrap();
        next.patch += 1;
        let version = next.to_string();
        let path = directory
            .path()
            .join(format!("novus_{version}_x64-setup.exe"));
        let mut payload = b"MZ".to_vec();
        payload.extend([42; 126]);
        fs::write(&path, &payload).unwrap();
        let cli =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../node_modules/@tauri-apps/cli/tauri.js");
        let signer = |args: &[&std::ffi::OsStr]| {
            let output = Command::new("node")
                .arg(&cli)
                .arg("signer")
                .args(args)
                .env_remove("TAURI_SIGNING_PRIVATE_KEY")
                .env_remove("TAURI_SIGNING_PRIVATE_KEY_PATH")
                .env_remove("TAURI_SIGNING_PRIVATE_KEY_PASSWORD")
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "Disposable Tauri signer must succeed"
            );
        };
        signer(&[
            "generate".as_ref(),
            "--ci".as_ref(),
            "--password".as_ref(),
            "disposable-updater-test".as_ref(),
            "--write-keys".as_ref(),
            key.as_os_str(),
        ]);
        signer(&[
            "sign".as_ref(),
            "--private-key-path".as_ref(),
            key.as_os_str(),
            "--password".as_ref(),
            "disposable-updater-test".as_ref(),
            "--app-version".as_ref(),
            version.as_ref(),
            path.as_os_str(),
        ]);
        let signature = fs::read_to_string(format!("{}.sig", path.display())).unwrap();
        let public_key = fs::read_to_string(format!("{}.pub", key.display())).unwrap();
        Self {
            directory,
            payload,
            signature,
            public_key,
            version,
        }
    }
}
struct Server {
    base: String,
    stop: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
}
impl Server {
    fn new(version: &str, signature: &str, payload: Vec<u8>, advertised_size: Option<u64>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let manifest = serde_json::json!({"version":version,"platforms":{"windows-x86_64":{"url":format!("{base}/installer"),"signature":signature.trim()}}}).to_string();
        let stop = Arc::new(AtomicBool::new(false));
        let signal = stop.clone();
        let worker = thread::spawn(move || {
            while !signal.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        // Windows can inherit the listener's nonblocking mode.
                        // Request reads must wait for bytes instead of treating
                        // WouldBlock as an empty request and replying 404.
                        stream.set_nonblocking(false).unwrap();
                        stream
                            .set_read_timeout(Some(Duration::from_secs(2)))
                            .unwrap();
                        let mut request = Vec::new();
                        let mut chunk = [0u8; 1024];
                        while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n")
                            && request.len() < 16384
                        {
                            let count = stream.read(&mut chunk).unwrap_or(0);
                            if count == 0 {
                                break;
                            }
                            request.extend_from_slice(&chunk[..count]);
                        }
                        let request = String::from_utf8_lossy(&request);
                        let (status, body, length) = if request.starts_with("GET /latest.json ") {
                            ("200 OK", manifest.as_bytes(), manifest.len() as u64)
                        } else if request.starts_with("GET /installer ") {
                            (
                                "200 OK",
                                payload.as_slice(),
                                advertised_size.unwrap_or(payload.len() as u64),
                            )
                        } else if request.starts_with("GET /huge-manifest ") {
                            ("200 OK", b"".as_slice(), MAX_MANIFEST_BYTES + 1)
                        } else if request.starts_with("GET /invalid-manifest ") {
                            ("200 OK", b"not json".as_slice(), 8)
                        } else {
                            ("404 Not Found", b"missing".as_slice(), 7)
                        };
                        let mut response = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {length}\r\nConnection: close\r\n\r\n").into_bytes();
                        response.extend_from_slice(body);
                        let _ = stream.write_all(&response);
                        // Send FIN and drain the peer before closing; dropping a socket
                        // with in-flight request bytes can send RST on Windows.
                        let _ = stream.shutdown(std::net::Shutdown::Write);
                        let _ = stream.read(&mut [0u8; 1]);
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5))
                    }
                    Err(_) => break,
                }
            }
        });
        Self {
            base,
            stop,
            worker: Some(worker),
        }
    }
}
impl Drop for Server {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.take() {
            worker.join().unwrap();
        }
    }
}
fn mock_app(fixture: &SigningFixture, server: &Server) -> tauri::App<tauri::test::MockRuntime> {
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.package_info_mut().version = env!("CARGO_PKG_VERSION").parse().unwrap();
    context.config_mut().plugins.0.insert(
        "updater".into(),
        serde_json::json!({
            "endpoints":[format!("{}/latest.json",server.base)], "pubkey":fixture.public_key.trim(),
            "dangerousInsecureTransportProtocol":true, "requireSignedVersion":true
        }),
    );
    tauri::test::mock_builder()
        .manage(UpdaterState::default())
        .invoke_handler(tauri::generate_handler![
            crate::updater::get_update_state,
            crate::updater::check_for_update,
            crate::updater::download_update,
            crate::updater::install_update,
            crate::updater::cancel_update,
            crate::updater::set_update_automatic
        ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap()
}

#[test]
fn real_updater_checks_downloads_verifies_and_rejects_tampering_without_installing() {
    tauri::async_runtime::block_on(async {
        let fixture = SigningFixture::new();
        let server = Server::new(
            &fixture.version,
            &fixture.signature,
            fixture.payload.clone(),
            None,
        );
        let app = mock_app(&fixture, &server);
        let updater = app
            .updater_builder()
            .target("windows-x86_64")
            .no_proxy()
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap();
        let client = Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap();
        let raw = fetch_manifest(&client, &format!("{}/latest.json", server.base))
            .await
            .unwrap()
            .unwrap();
        let update = updater.restore_update(raw).unwrap().unwrap();
        let (path, length) =
            download_package(&update, &client, fixture.directory.path(), |_, _| {})
                .await
                .unwrap();
        assert_eq!(length as usize, fixture.payload.len());
        assert_eq!(read_verified(&update, &path).unwrap(), fixture.payload);
        let mut damaged = fixture.payload.clone();
        damaged[50] ^= 1;
        fs::write(&path, &damaged).unwrap();
        assert_eq!(read_verified(&update, &path).unwrap_err().code, "signature");
        // Plugin install verifies before creating or launching an installer.
        assert!(update.install(&damaged).is_err());
        let mut wrong_version = update.clone();
        let mut other: semver::Version = fixture.version.parse().unwrap();
        other.patch += 1;
        wrong_version.version = other.to_string();
        fs::write(&path, &fixture.payload).unwrap();
        assert_eq!(
            read_verified(&wrong_version, &path).unwrap_err().code,
            "signature"
        );
        let mut canonical = update.clone();
        canonical.download_url = format!(
            "https://github.com/HYS1753/novus/releases/download/v{}/novus_{}_x64-setup.exe",
            fixture.version, fixture.version
        )
        .parse()
        .unwrap();
        validate_update(&canonical).unwrap();
        for url in [
            "http://github.com/HYS1753/novus/update.exe",
            "https://example.com/update.exe",
        ] {
            canonical.download_url = url.parse().unwrap();
            assert!(validate_update(&canonical).is_err());
        }
        let mut no_update_context = tauri::test::mock_context(tauri::test::noop_assets());
        no_update_context.package_info_mut().version = fixture.version.parse().unwrap();
        no_update_context.config_mut().plugins.0 = app.config().plugins.0.clone();
        let current = tauri::test::mock_builder()
            .plugin(tauri_plugin_updater::Builder::new().build())
            .build(no_update_context)
            .unwrap();
        assert!(current
            .updater_builder()
            .target("windows-x86_64")
            .no_proxy()
            .build()
            .unwrap()
            .check()
            .await
            .unwrap()
            .is_none());
        assert!(updater.check().await.is_ok());
        let missing = app
            .updater_builder()
            .endpoints(vec![format!("{}/missing", server.base).parse().unwrap()])
            .unwrap()
            .no_proxy()
            .build()
            .unwrap();
        assert!(missing.check().await.is_err());
        assert_eq!(
            fetch_manifest(&client, &format!("{}/missing", server.base))
                .await
                .unwrap_err()
                .code,
            "release_unavailable"
        );
        assert_eq!(
            fetch_manifest(&client, &format!("{}/huge-manifest", server.base))
                .await
                .unwrap_err()
                .code,
            "too_large"
        );
        assert_eq!(
            fetch_manifest(&client, &format!("{}/invalid-manifest", server.base))
                .await
                .unwrap_err()
                .code,
            "invalid_release"
        );
        let oversized = Server::new(
            &fixture.version,
            &fixture.signature,
            fixture.payload.clone(),
            Some(MAX_BYTES + 1),
        );
        let mut large_update = update.clone();
        large_update.download_url = format!("{}/installer", oversized.base).parse().unwrap();
        assert_eq!(
            download_package(&large_update, &client, fixture.directory.path(), |_, _| {})
                .await
                .unwrap_err()
                .code,
            "too_large"
        );
        let rejected_cache = tempfile::tempdir().unwrap();
        let mut corrupted = fixture.payload.clone();
        corrupted[55] ^= 1;
        let bad_server = Server::new(&fixture.version, &fixture.signature, corrupted, None);
        let mut bad_update = update.clone();
        bad_update.download_url = format!("{}/installer", bad_server.base).parse().unwrap();
        assert_eq!(
            download_package(&bad_update, &client, rejected_cache.path(), |_, _| {})
                .await
                .unwrap_err()
                .code,
            "signature"
        );
        assert_eq!(fs::read_dir(rejected_cache.path()).unwrap().count(), 0);
        let (signal, mut cancel) = watch::channel(0u64);
        let result = cancellable(
            &mut cancel,
            download_package(&update, &client, rejected_cache.path(), |_, _| {
                signal.send_replace(1);
            }),
        )
        .await;
        assert_eq!(result.unwrap_err().code, "cancelled");
        // A verifier already running in the blocking pool finishes and drops its temp file.
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(fs::read_dir(rejected_cache.path()).unwrap().count(), 0);
    });
}

#[test]
fn ipc_exposes_typed_state_and_blocks_overlay_calls_and_uninstalled_installation() {
    let fixture = SigningFixture::new();
    let server = Server::new(
        &fixture.version,
        &fixture.signature,
        fixture.payload.clone(),
        None,
    );
    let app = mock_app(&fixture, &server);
    let main = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let overlay = tauri::WebviewWindowBuilder::new(&app, "video-controls-test", Default::default())
        .build()
        .unwrap();
    let invoke = |view: &tauri::WebviewWindow<tauri::test::MockRuntime>,
                  command: &str,
                  body: serde_json::Value| {
        tauri::test::get_ipc_response(
            view,
            tauri::webview::InvokeRequest {
                cmd: command.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: "http://tauri.localhost".parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.into(),
            },
        )
        .map(|response| response.deserialize::<serde_json::Value>().unwrap())
    };
    let status = invoke(&main, "get_update_state", serde_json::json!({})).unwrap();
    assert_eq!(status["phase"], "idle");
    assert_eq!(status["currentVersion"], env!("CARGO_PKG_VERSION"));
    assert_eq!(status["canInstall"], false);
    let body = serde_json::json!({"expectedVersion":fixture.version,"enabled":false});
    assert_eq!(
        invoke(&main, "download_update", body.clone()).unwrap_err()["code"],
        "stale_update"
    );
    assert_eq!(
        invoke(&main, "install_update", body.clone()).unwrap_err()["code"],
        "installation_required"
    );
    for command in [
        "get_update_state",
        "check_for_update",
        "download_update",
        "install_update",
        "cancel_update",
        "set_update_automatic",
    ] {
        assert_eq!(
            invoke(&overlay, command, body.clone()).unwrap_err()["code"],
            "forbidden"
        );
    }
    assert_eq!(
        invoke(&main, "check_for_update", serde_json::json!({})).unwrap_err()["code"],
        "configuration"
    );
    assert_eq!(
        invoke(&main, "get_update_state", serde_json::json!({})).unwrap()["phase"],
        "error"
    );
    assert_eq!(
        invoke(&main, "cancel_update", serde_json::json!({})).unwrap()["phase"],
        "idle"
    );
}

#[test]
fn automatic_off_cancels_auto_work_and_gates_queued_work_while_manual_work_survives() {
    tauri::async_runtime::block_on(async {
        let fixture = SigningFixture::new();
        let server = Server::new(
            &fixture.version,
            &fixture.signature,
            fixture.payload.clone(),
            None,
        );
        let app = mock_app(&fixture, &server);
        let state = UpdaterState::default();
        let prefs = fixture.directory.path().join("updater.json");
        {
            let mut inner = state.lock().unwrap();
            inner.preferences_path = Some(prefs.clone());
            inner.status.preferences_ready = true;
            inner.status.automatic_enabled = true;
            inner.status.can_install = true;
        }
        let (generation, mut signal, _) = state.begin(Phase::Checking, None, true).unwrap();
        set_automatic(app.handle(), &state, false).await.unwrap();
        signal.changed().await.unwrap();
        assert_eq!(state.snapshot().unwrap().phase, Phase::Idle);
        assert!(!state.snapshot().unwrap().automatic_enabled);
        assert_eq!(
            state.begin(Phase::Checking, None, true).err().unwrap().code,
            "cancelled"
        );
        assert_eq!(
            state
                .finish(app.handle(), generation, Ok(Completion::Checked(None)))
                .unwrap_err()
                .code,
            "cancelled"
        );
        let (manual, _, _) = state.begin(Phase::Checking, None, false).unwrap();
        set_automatic(app.handle(), &state, false).await.unwrap();
        assert_eq!(state.snapshot().unwrap().phase, Phase::Checking);
        state
            .finish(app.handle(), manual, Ok(Completion::Checked(None)))
            .unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&fs::read(prefs).unwrap()).unwrap()
                ["automaticEnabled"],
            false
        );
        assert_eq!(state.snapshot().unwrap().phase, Phase::UpToDate);
    });
}

#[test]
fn state_rejects_duplicate_work_stale_versions_and_late_completion_after_cancel() {
    let fixture = SigningFixture::new();
    let server = Server::new(
        &fixture.version,
        &fixture.signature,
        fixture.payload.clone(),
        None,
    );
    let app = mock_app(&fixture, &server);
    let state = UpdaterState::default();
    let (generation, _, _) = state.begin(Phase::Checking, None, false).unwrap();
    assert_eq!(
        state
            .begin(Phase::Checking, None, false)
            .err()
            .unwrap()
            .code,
        "busy"
    );
    cancel(app.handle(), &state).unwrap();
    assert_eq!(
        state
            .finish(app.handle(), generation, Ok(Completion::Checked(None)))
            .unwrap_err()
            .code,
        "cancelled"
    );
    assert_eq!(state.snapshot().unwrap().phase, Phase::Idle);
    assert_eq!(
        state
            .begin(Phase::Downloading, Some("0.2.1"), false)
            .err()
            .unwrap()
            .code,
        "stale_update"
    );
    assert!(!state.snapshot().unwrap().can_install);
}
