use super::*;
use serde::{Deserialize, Serialize};
use std::io::Write;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Preferences {
    schema_version: u8,
    automatic_enabled: bool,
}
fn preference_error() -> UpdateFailure {
    failure(
        "preferences",
        "자동 업데이트 설정을 저장하거나 읽지 못했습니다. 다시 저장해 주세요.",
    )
}
fn read_preferences(path: &Path) -> Result<bool> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(true),
        Err(_) => return Err(preference_error()),
    };
    let mut bytes = Vec::new();
    file.take(4097)
        .read_to_end(&mut bytes)
        .map_err(|_| preference_error())?;
    if bytes.len() > 4096 {
        return Err(preference_error());
    }
    let prefs: Preferences = serde_json::from_slice(&bytes).map_err(|_| preference_error())?;
    if prefs.schema_version != 1 {
        return Err(preference_error());
    }
    Ok(prefs.automatic_enabled)
}
fn save_preferences(path: &Path, enabled: bool) -> Result<()> {
    let parent = path.parent().ok_or_else(preference_error)?;
    fs::create_dir_all(parent).map_err(|_| preference_error())?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|_| preference_error())?;
    let bytes = serde_json::to_vec(&Preferences {
        schema_version: 1,
        automatic_enabled: enabled,
    })
    .map_err(|_| preference_error())?;
    file.write_all(&bytes).map_err(|_| preference_error())?;
    file.as_file().sync_all().map_err(|_| preference_error())?;
    file.persist(path).map_err(|_| preference_error())?;
    Ok(())
}
pub fn initialize_preferences<R: tauri::Runtime>(app: &AppHandle<R>) {
    let state = app.state::<UpdaterState>();
    let path = app
        .path()
        .app_config_dir()
        .ok()
        .map(|path| path.join("updater.json"));
    let loaded = path
        .as_deref()
        .ok_or_else(preference_error)
        .and_then(read_preferences);
    if let Ok(mut inner) = state.lock() {
        inner.preferences_path = path;
        inner.status.automatic_enabled =
            loaded.as_ref().copied().unwrap_or(false) && super::super::SUPPORTED;
        inner.status.preference_error = loaded.err();
        inner.status.preferences_ready = true;
        inner.status.revision += 1;
    };
    if let Ok(snapshot) = state.snapshot() {
        let _ = app.emit_to("main", EVENT, snapshot);
    }
}
pub async fn set_automatic<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &UpdaterState,
    enabled: bool,
) -> Result<UpdateStatus> {
    let path = {
        let mut inner = state.lock()?;
        if inner.status.preference_saving {
            return Err(failure("busy", "업데이트 설정을 저장 중입니다."));
        }
        if inner.status.phase == Phase::Installing {
            return Err(failure(
                "busy",
                "설치 시작 후에는 설정을 변경할 수 없습니다.",
            ));
        }
        // OFF also gates an auto command that has not entered begin() yet.
        if !enabled {
            inner.status.automatic_enabled = false;
            if inner.automatic_operation {
                reset_operation(state, &mut inner);
            }
        }
        inner.status.preference_saving = true;
        inner.status.revision += 1;
        inner.preferences_path.clone()
    };
    let _ = app.emit_to("main", EVENT, state.snapshot()?);
    let result = tauri::async_runtime::spawn_blocking(move || {
        save_preferences(&path.ok_or_else(preference_error)?, enabled)
    })
    .await
    .map_err(|_| preference_error())
    .and_then(|result| result);
    let mut inner = state.lock()?;
    if result.is_err() && inner.automatic_operation {
        reset_operation(state, &mut inner);
    }
    inner.status.preference_saving = false;
    inner.status.preferences_ready = true;
    inner.status.automatic_enabled = enabled && result.is_ok();
    inner.status.preference_error = result.as_ref().err().cloned();
    inner.status.revision += 1;
    let snapshot = inner.status.clone();
    drop(inner);
    let _ = app.emit_to("main", EVENT, &snapshot);
    result.map(|_| snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preferences_survive_reload_and_corruption_is_not_treated_as_on() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("updater.json");
        assert!(read_preferences(&path).unwrap());
        save_preferences(&path, false).unwrap();
        assert!(!read_preferences(&path).unwrap());
        save_preferences(&path, true).unwrap();
        assert!(read_preferences(&path).unwrap());
        fs::write(&path, b"invalid").unwrap();
        assert_eq!(read_preferences(&path).unwrap_err().code, "preferences");
        assert!(save_preferences(directory.path(), false).is_err());
    }
}
