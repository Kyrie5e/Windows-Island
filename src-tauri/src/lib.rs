use tauri::Manager;

mod commands;
mod config;
mod window;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();

            // Apply acrylic effect on Windows
            #[cfg(target_os = "windows")]
            {
                window::set_fullscreen_width(&win);
                window::set_webview_transparent(&win);
            }

            // Native cursor tracking — bypasses WebView2 throttling
            window::start_cursor_tracker(win.clone());

            // Start WebSocket server for Claude Code agent status
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                commands::agent::start_ws_server(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::volume::get_volume,
            commands::volume::set_volume,
            commands::brightness::get_brightness,
            commands::brightness::set_brightness,
            commands::battery::get_battery,
            commands::network::get_wifi,
            commands::bluetooth::get_bluetooth,
            commands::media::get_media,
            commands::media::media_control,
            commands::notification::get_latest_notification,
            commands::gamemode::is_game_mode,
            commands::window::resize_window,
            commands::agent::send_agent_response,
            commands::agent::focus_agent_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
