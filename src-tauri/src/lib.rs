mod commands;
pub mod page_manager;

use commands::system::{
    attach_child_webview, close_child_webview, close_media_window, get_system_status,
    launch_native_app_mode, open_media_window,
};
use page_manager::{
    discard_streaming_page, go_back_or_close_streaming_page, hide_streaming_page,
    reload_streaming_page, show_streaming_page, update_streaming_page_bounds, PageManagerState,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PageManagerState::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_status,
            open_media_window,
            close_media_window,
            attach_child_webview,
            close_child_webview,
            show_streaming_page,
            hide_streaming_page,
            update_streaming_page_bounds,
            reload_streaming_page,
            discard_streaming_page,
            go_back_or_close_streaming_page,
            launch_native_app_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
