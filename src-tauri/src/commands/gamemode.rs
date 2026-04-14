use crate::config;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct GameModeStatus {
    pub active: bool,
    pub reason: String,
}

#[tauri::command]
pub fn is_game_mode() -> Result<GameModeStatus, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::{
            Foundation::HWND,
            Graphics::Gdi::{MonitorFromWindow, GetMonitorInfoW, MONITORINFO, MONITOR_DEFAULTTOPRIMARY},
            UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId},
            System::ProcessStatus::GetModuleFileNameExW,
            System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ},
        };

        let cfg = config::load();

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.is_invalid() {
                return Ok(GameModeStatus { active: false, reason: String::new() });
            }

            // Check if foreground window is fullscreen
            let mut rect = windows::Win32::Foundation::RECT::default();
            let _ = GetWindowRect(hwnd, &mut rect);

            let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTOPRIMARY);
            let mut info = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            let _ = GetMonitorInfoW(monitor, &mut info);

            let is_fullscreen = rect.left <= info.rcMonitor.left
                && rect.top <= info.rcMonitor.top
                && rect.right >= info.rcMonitor.right
                && rect.bottom >= info.rcMonitor.bottom;

            if !is_fullscreen {
                return Ok(GameModeStatus { active: false, reason: String::new() });
            }

            // Check process name against blacklist
            if cfg.game_mode.auto_detect {
                let mut pid = 0u32;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
                if pid != 0 {
                    let proc = OpenProcess(
                        PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                        false,
                        pid,
                    );
                    if let Ok(proc_handle) = proc {
                        let mut buf = vec![0u16; 260];
                        let len = GetModuleFileNameExW(proc_handle, None, &mut buf);
                        if len > 0 {
                            let name = String::from_utf16_lossy(&buf[..len as usize]);
                            let exe = std::path::Path::new(&name)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_lowercase();

                            // Check blacklist
                            for blocked in &cfg.game_mode.process_blacklist {
                                if exe.contains(&blocked.to_lowercase()) {
                                    return Ok(GameModeStatus {
                                        active: true,
                                        reason: format!("blacklist: {}", exe),
                                    });
                                }
                            }

                            // Auto-detect: fullscreen non-browser/explorer process
                            let system_procs = ["explorer.exe", "searchhost.exe", "shellexperiencehost.exe"];
                            let is_system = system_procs.iter().any(|p| exe == *p);
                            if !is_system {
                                return Ok(GameModeStatus {
                                    active: true,
                                    reason: format!("fullscreen: {}", exe),
                                });
                            }
                        }
                    }
                }
            }

            Ok(GameModeStatus { active: false, reason: String::new() })
        }
    }
    #[cfg(not(target_os = "windows"))]
    Ok(GameModeStatus { active: false, reason: String::new() })
}
