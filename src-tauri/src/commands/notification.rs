use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct NotificationInfo {
    pub app: String,
    pub title: String,
    pub body: String,
}

#[tauri::command]
pub fn get_latest_notification() -> Result<Option<NotificationInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use rusqlite::{Connection, OpenFlags};

        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let db_path = format!(
            r"{}\Microsoft\Windows\Notifications\wpndatabase.db",
            local_app_data
        );

        // Open read-only, don't fail if DB locked (system may have it open)
        let conn = Connection::open_with_flags(
            &db_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT AppId, Id, Payload FROM Notification \
                 ORDER BY ArrivalTime DESC LIMIT 1",
            )
            .map_err(|e| e.to_string())?;

        let result = stmt.query_row([], |row| {
            let app: String = row.get(0)?;
            let _id: i64 = row.get(1)?;
            let payload: String = row.get(2)?;
            Ok((app, payload))
        });

        match result {
            Ok((app, payload)) => {
                // Extract title and body from XML payload (basic parse)
                let title = extract_xml_text(&payload, "text").unwrap_or_default();
                let body = extract_xml_texts(&payload);
                Ok(Some(NotificationInfo { app, title, body }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(target_os = "windows"))]
    Ok(None)
}

fn extract_xml_text(xml: &str, _tag: &str) -> Option<String> {
    // Simple extraction: find first <text> content
    let start = xml.find("<text")?;
    let content_start = xml[start..].find('>')? + start + 1;
    let content_end = xml[content_start..].find('<')? + content_start;
    let text = xml[content_start..content_end].trim();
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

fn extract_xml_texts(xml: &str) -> String {
    // Get second <text> element as body
    let mut texts = Vec::new();
    let mut search = xml;
    while let Some(start) = search.find("<text") {
        if let Some(content_start) = search[start..].find('>').map(|i| i + start + 1) {
            if let Some(content_end) = search[content_start..].find('<').map(|i| i + content_start) {
                let text = search[content_start..content_end].trim();
                if !text.is_empty() {
                    texts.push(text.to_string());
                }
                search = &search[content_end..];
            } else {
                break;
            }
        } else {
            break;
        }
    }
    texts.into_iter().skip(1).collect::<Vec<_>>().join(" ")
}
