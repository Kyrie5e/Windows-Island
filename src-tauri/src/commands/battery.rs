use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BatteryInfo {
    pub percent: u8,
    pub charging: bool,
    pub no_battery: bool,
}

#[tauri::command]
pub fn get_battery() -> Result<BatteryInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
        unsafe {
            let mut status = SYSTEM_POWER_STATUS::default();
            GetSystemPowerStatus(&mut status)
                .map_err(|e| e.to_string())?;
            Ok(BatteryInfo {
                percent: status.BatteryLifePercent,
                charging: status.ACLineStatus == 1,
                no_battery: status.BatteryLifePercent == 255,
            })
        }
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}
