mod commands;
pub mod page_manager;
use tauri::Manager;

use commands::device_profile::{get_device_profile, DeviceProfile};
use commands::embedded_player::{
    close_embedded_video, control_embedded_video, get_embedded_player_support,
    get_embedded_video_state, open_embedded_video, open_embedded_video_overlay,
    request_embedded_video_overlay_action, update_embedded_video_bounds, EmbeddedPlayerState,
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
    list_streaming_pages, reload_streaming_page, show_streaming_page, update_streaming_page_bounds,
    PageManagerState,
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
            list_streaming_pages,
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
            control_embedded_video,
            get_embedded_video_state,
            open_embedded_video_overlay,
            request_embedded_video_overlay_action
        ])
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if matches!(
                event,
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)
            ) {
                for (label, overlay) in window.app_handle().webview_windows() {
                    if !label.starts_with("video-controls-") {
                        continue;
                    }
                    if let Ok(position) = window.inner_position() {
                        let _ = overlay.set_position(position);
                    }
                    if let Ok(size) = window.inner_size() {
                        let _ = overlay.set_size(size);
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
