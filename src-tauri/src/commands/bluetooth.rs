#[tauri::command]
pub fn get_bluetooth() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Devices::Bluetooth::BluetoothAdapter;
        use windows::Devices::Radios::RadioState;

        let adapter = BluetoothAdapter::GetDefaultAsync()
            .map_err(|e: windows::core::Error| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?;

        // Get the radio associated with this adapter to check actual on/off state
        let radio_result = adapter
            .GetRadioAsync()
            .map_err(|e| e.to_string())?
            .get();

        match radio_result {
            Ok(radio) => {
                let state = radio.State().map_err(|e| e.to_string())?;
                Ok(state == RadioState::On)
            }
            Err(_) => {
                // Fallback: if radio API fails, check if adapter is powered on
                Ok(false)
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}
