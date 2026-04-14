use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub playing: bool,
    pub has_session: bool,
}

#[tauri::command]
pub async fn get_media() -> Result<MediaInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Media::Control::{
            GlobalSystemMediaTransportControlsSessionManager,
            GlobalSystemMediaTransportControlsSessionPlaybackStatus,
        };

        let manager: GlobalSystemMediaTransportControlsSessionManager =
            GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
                .map_err(|e: windows::core::Error| e.to_string())?
                .get()
                .map_err(|e: windows::core::Error| e.to_string())?;

        let session = match manager.GetCurrentSession() {
            Ok(s) => s,
            Err(_) => {
                return Ok(MediaInfo {
                    title: String::new(),
                    artist: String::new(),
                    playing: false,
                    has_session: false,
                })
            }
        };

        let props = session
            .TryGetMediaPropertiesAsync()
            .map_err(|e: windows::core::Error| e.to_string())?
            .get()
            .map_err(|e: windows::core::Error| e.to_string())?;

        let title = props.Title().map(|s: windows::core::HSTRING| s.to_string()).unwrap_or_default();
        let artist = props.Artist().map(|s: windows::core::HSTRING| s.to_string()).unwrap_or_default();

        let playing = session
            .GetPlaybackInfo()
            .ok()
            .and_then(|info: windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackInfo| info.PlaybackStatus().ok())
            .map(|s| s == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
            .unwrap_or(false);

        Ok(MediaInfo {
            title,
            artist,
            playing,
            has_session: true,
        })
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}

#[tauri::command]
pub async fn media_control(action: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

        let manager: GlobalSystemMediaTransportControlsSessionManager =
            GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
                .map_err(|e: windows::core::Error| e.to_string())?
                .get()
                .map_err(|e: windows::core::Error| e.to_string())?;

        let session = manager.GetCurrentSession().map_err(|e: windows::core::Error| e.to_string())?;

        match action.as_str() {
            "play" => {
                session
                    .TryPlayAsync()
                    .map_err(|e: windows::core::Error| e.to_string())?
                    .get()
                    .map_err(|e: windows::core::Error| e.to_string())?;
            }
            "pause" => {
                session
                    .TryPauseAsync()
                    .map_err(|e: windows::core::Error| e.to_string())?
                    .get()
                    .map_err(|e: windows::core::Error| e.to_string())?;
            }
            "next" => {
                session
                    .TrySkipNextAsync()
                    .map_err(|e: windows::core::Error| e.to_string())?
                    .get()
                    .map_err(|e: windows::core::Error| e.to_string())?;
            }
            "prev" => {
                session
                    .TrySkipPreviousAsync()
                    .map_err(|e: windows::core::Error| e.to_string())?
                    .get()
                    .map_err(|e: windows::core::Error| e.to_string())?;
            }
            _ => return Err(format!("unknown action: {}", action)),
        }

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    Err("not supported".into())
}
