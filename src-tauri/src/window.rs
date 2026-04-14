use tauri::{Emitter, WebviewWindow};

#[cfg(target_os = "windows")]
use windows::Win32::{
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTOPRIMARY},
    UI::WindowsAndMessaging::{GetCursorPos, GetDesktopWindow},
};

const PILL_WIDTH: u32 = 480;

#[cfg(target_os = "windows")]
pub fn set_fullscreen_width(window: &WebviewWindow) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    unsafe {
        let desktop = GetDesktopWindow();
        let monitor = MonitorFromWindow(desktop, MONITOR_DEFAULTTOPRIMARY);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(monitor, &mut info).as_bool() {
            let screen_width_logical = (info.rcMonitor.right - info.rcMonitor.left) as f64 / scale_factor;
            let x_logical = (screen_width_logical - PILL_WIDTH as f64) / 2.0;
            let y_logical = info.rcMonitor.top as f64 / scale_factor;
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: PILL_WIDTH as f64,
                height: 20.0,
            }));
            let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                x: x_logical,
                y: y_logical,
            }));
        }
    }
}

#[cfg(target_os = "windows")]
pub fn set_webview_transparent(window: &WebviewWindow) {
    use tauri::window::Color;
    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
}

#[cfg(not(target_os = "windows"))]
pub fn set_webview_transparent(_window: &WebviewWindow) {}

#[cfg(not(target_os = "windows"))]
pub fn set_fullscreen_width(_window: &WebviewWindow) {}

#[cfg(not(target_os = "windows"))]
pub fn start_cursor_tracker(_window: WebviewWindow) {}

/// Poll cursor position via Win32 API every 30ms.
/// Emits "cursor-enter" / "cursor-leave" events to frontend,
/// bypassing WebView2 which stops processing mouse events when unfocused.
#[cfg(target_os = "windows")]
pub fn start_cursor_tracker(window: WebviewWindow) {
    use windows::Win32::Foundation::POINT;

    std::thread::spawn(move || {
        let mut was_inside = false;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(30));

            let mut cursor = POINT::default();
            let ok = unsafe { GetCursorPos(&mut cursor).is_ok() };
            if !ok {
                continue;
            }

            let inside = match (window.outer_position(), window.outer_size()) {
                (Ok(pos), Ok(size)) => {
                    cursor.x >= pos.x
                        && cursor.x < pos.x + size.width as i32
                        && cursor.y >= pos.y
                        && cursor.y < pos.y + size.height as i32
                }
                _ => false,
            };

            if inside && !was_inside {
                let _ = window.emit("cursor-enter", ());
                was_inside = true;
            } else if !inside && was_inside {
                let _ = window.emit("cursor-leave", ());
                was_inside = false;
            }
        }
    });
}
