#[tauri::command]
pub fn get_volume() -> Result<f32, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::{
            Media::Audio::{
                eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
            },
            Media::Audio::Endpoints::IAudioEndpointVolume,
            System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED},
        };
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e: windows::core::Error| e.to_string())?;
            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e: windows::core::Error| e.to_string())?;
            let vol: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
                .map_err(|e: windows::core::Error| e.to_string())?;
            vol.GetMasterVolumeLevelScalar().map_err(|e: windows::core::Error| e.to_string())
        }
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}

#[tauri::command]
pub fn set_volume(level: f32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::{
            Media::Audio::{
                eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
            },
            Media::Audio::Endpoints::IAudioEndpointVolume,
            System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED},
        };
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e: windows::core::Error| e.to_string())?;
            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e: windows::core::Error| e.to_string())?;
            let vol: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
                .map_err(|e: windows::core::Error| e.to_string())?;
            vol.SetMasterVolumeLevelScalar(level.clamp(0.0, 1.0), std::ptr::null())
                .map_err(|e: windows::core::Error| e.to_string())
        }
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}
