#[tauri::command]
pub fn get_system_status() -> Result<String, String> {
    Ok("healthy".to_string())
}
