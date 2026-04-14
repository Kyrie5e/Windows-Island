use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BrightnessInfo {
    pub level: u32,
    pub supported: bool,
}

#[tauri::command]
pub fn get_brightness() -> Result<BrightnessInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness",
            ])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return Ok(BrightnessInfo { level: 0, supported: false });
        }
        let level: u32 = stdout.parse().unwrap_or(0);
        Ok(BrightnessInfo { level, supported: true })
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}

#[tauri::command]
pub fn set_brightness(level: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = format!(
            "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {})",
            level.min(100)
        );
        Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}
