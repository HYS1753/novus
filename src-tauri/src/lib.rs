mod commands;
pub mod page_manager;

use commands::device_profile::{get_device_profile, DeviceProfile};
use commands::embedded_player::{
    close_embedded_video, control_embedded_video, get_embedded_player_support, open_embedded_video,
    update_embedded_video_bounds, EmbeddedPlayerState,
};
use commands::media_fs::{
    get_media_page, get_system_locations, open_file_in_os, scan_directory, MediaPageState,
};
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
    tauri::Builder::default()
        .manage(PageManagerState::new())
        .manage(MediaPageState::default())
        .manage(EmbeddedPlayerState::default())
        .manage(DeviceProfile::detect())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_status,
            get_device_profile,
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
            get_media_page,
            open_file_in_os,
            get_image_thumbnail,
            cleanup_thumbnail_cache,
            play_video_native,
            get_embedded_player_support,
            open_embedded_video,
            update_embedded_video_bounds,
            close_embedded_video,
            control_embedded_video
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
