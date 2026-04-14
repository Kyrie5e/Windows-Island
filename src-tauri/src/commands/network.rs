use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct WifiInfo {
    pub connected: bool,
    pub ssid: String,
    pub signal: u8,
}

#[tauri::command]
pub fn get_wifi() -> Result<WifiInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Use netsh as the most reliable cross-version approach
        let output = Command::new("netsh")
            .args(["wlan", "show", "interfaces"])
            .output()
            .map_err(|e| e.to_string())?;

        let text = String::from_utf8_lossy(&output.stdout);

        let mut ssid = String::new();
        let mut signal: u8 = 0;
        let mut connected = false;

        for line in text.lines() {
            let line = line.trim();
            // Support both English and Chinese netsh output
            if (line.starts_with("State") || line.starts_with("状态"))
                && (line.contains("connected") || line.contains("已连接"))
            {
                connected = true;
            }
            if line.starts_with("SSID") && !line.starts_with("BSSID") {
                if let Some(val) = line.splitn(2, ':').nth(1) {
                    ssid = val.trim().to_string();
                }
            }
            if line.starts_with("Signal") || line.starts_with("信号") {
                if let Some(val) = line.splitn(2, ':').nth(1) {
                    let pct = val.trim().trim_end_matches('%');
                    signal = pct.parse().unwrap_or(0);
                }
            }
        }

        Ok(WifiInfo { connected, ssid, signal })
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}
