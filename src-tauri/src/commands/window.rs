use tauri::Window;

/// Fixed pill width in logical pixels. Matches the CSS panel width.
const PILL_WIDTH: u32 = 480;

#[tauri::command]
pub fn resize_window(window: Window, height: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::{
            Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTOPRIMARY},
            UI::WindowsAndMessaging::GetDesktopWindow,
        };
        let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
        unsafe {
            let desktop = GetDesktopWindow();
            let monitor = MonitorFromWindow(desktop, MONITOR_DEFAULTTOPRIMARY);
            let mut info = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            let _ = GetMonitorInfoW(monitor, &mut info);
            // Screen dimensions are in physical pixels, convert to logical
            let screen_width_logical = (info.rcMonitor.right - info.rcMonitor.left) as f64 / scale_factor;
            let x_logical = (screen_width_logical - PILL_WIDTH as f64) / 2.0;
            let y_logical = info.rcMonitor.top as f64 / scale_factor;
            window
                .set_size(tauri::Size::Logical(tauri::LogicalSize { width: PILL_WIDTH as f64, height: height as f64 }))
                .map_err(|e| e.to_string())?;
            window
                .set_position(tauri::Position::Logical(tauri::LogicalPosition {
                    x: x_logical,
                    y: y_logical,
                }))
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: PILL_WIDTH as f64,
                height: height as f64,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
