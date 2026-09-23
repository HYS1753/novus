mod commands;
pub mod page_manager;

use commands::media_fs::{get_system_locations, open_file_in_os, scan_directory};
use commands::player::play_video_native;
use commands::system::{
    attach_child_webview, close_child_webview, close_media_window, get_system_status,
    launch_native_app_mode, open_media_window,
};
use commands::thumbnail::{cleanup_thumbnail_cache, get_image_thumbnail};
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
    // Cleanup any orphaned session thumbnails from previous runs
    let _ = cleanup_thumbnail_cache();

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
            launch_native_app_mode,
            // Media & Finder commands
            get_system_locations,
            scan_directory,
            open_file_in_os,
            get_image_thumbnail,
            cleanup_thumbnail_cache,
            play_video_native
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Ensure session thumbnails are cleaned up on app exit
                let _ = cleanup_thumbnail_cache();
            }
        });
}
