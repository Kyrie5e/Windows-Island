use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_tungstenite::{accept_async, tungstenite::Message, WebSocketStream};

type WsSink = futures_util::stream::SplitSink<WebSocketStream<TcpStream>, Message>;

/// Global handle to the current WebSocket write half.
/// Allows sending messages back to the connected agent (Claude Code).
static WS_WRITER: std::sync::OnceLock<Arc<Mutex<Option<WsSink>>>> = std::sync::OnceLock::new();

fn get_ws_writer() -> &'static Arc<Mutex<Option<WsSink>>> {
    WS_WRITER.get_or_init(|| Arc::new(Mutex::new(None)))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentStatus {
    pub state: String,
    pub tool: Option<String>,
    pub message: Option<String>,
}

/// Send a response back to the connected agent.
///
/// Permission actions (approve/always_allow/deny) only write a response file
/// that island-permission.ps1 polls — the hook's exit code controls Claude Code.
/// No keyboard injection needed for permissions.
///
/// - "approve": writes "approve" to temp file → hook exits 0
/// - "always_allow": writes "always_allow" → hook persists to settings.local.json, then exits 0
/// - "deny": writes "deny" → hook exits 2 (blocks)
/// - "cancel": writes "cancel" → hook exits 0 (used for auto-approved tools)
/// - "ask": focuses the Claude terminal and types the message + Enter (keyboard injection)
#[tauri::command]
pub async fn send_agent_response(action: String, message: Option<String>) -> Result<(), String> {
    match action.as_str() {
        "ask" => {
            let text = message.unwrap_or_default();
            if text.is_empty() {
                return Err("Message is required for ask action".to_string());
            }
            focus_agent_window()?;
            std::thread::sleep(std::time::Duration::from_millis(150));
            type_text_to_foreground(&text);
            send_key_enter();
            Ok(())
        }
        "approve" => {
            // Write response to temp file for island-permission.ps1 to read.
            // The hook script's exit code (0) controls Claude Code's permission —
            // no keyboard injection needed.
            write_permission_response("approve")
        }
        "always_allow" => {
            // Write response to temp file. island-permission.ps1 will also
            // persist the tool to settings.local.json before exiting 0.
            write_permission_response("always_allow")
        }
        "deny" => {
            // Write response to temp file. island-permission.ps1 exits 2 to block.
            write_permission_response("deny")
        }
        "cancel" => {
            // Only write cancel to file — no keyboard injection.
            // Used when an already-allowed tool triggered permission_required
            // and Claude Code auto-approved without waiting for user input.
            write_permission_response("cancel")
        }
        _ => Err(format!("Unknown action: {}", action)),
    }
}

/// Focus the terminal window running Claude Code.
#[tauri::command]
pub fn focus_agent_window() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
            SetForegroundWindow, ShowWindow, SW_RESTORE,
        };

        unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            if !IsWindowVisible(hwnd).as_bool() {
                return BOOL(1);
            }
            let len = GetWindowTextLengthW(hwnd);
            if len == 0 {
                return BOOL(1);
            }
            let mut buf = vec![0u16; (len + 1) as usize];
            let actual = GetWindowTextW(hwnd, &mut buf);
            if actual == 0 {
                return BOOL(1);
            }
            let title = OsString::from_wide(&buf[..actual as usize])
                .to_string_lossy()
                .to_lowercase();

            // Match windows with "claude" in title
            if title.contains("claude") {
                let found = &mut *(lparam.0 as *mut Option<HWND>);
                *found = Some(hwnd);
                return BOOL(0); // stop enumeration
            }
            BOOL(1)
        }

        unsafe {
            let mut found: Option<HWND> = None;
            let lparam = LPARAM(&mut found as *mut _ as isize);
            let _ = EnumWindows(Some(enum_callback), lparam);

            match found {
                Some(hwnd) => {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                    let _ = SetForegroundWindow(hwnd);
                    Ok(())
                }
                None => Err("Claude Code window not found".to_string()),
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not supported on this platform".to_string())
    }
}

pub async fn start_ws_server(app: AppHandle) {
    let addr: SocketAddr = "127.0.0.1:27182".parse().unwrap();
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[windows-island] WebSocket server failed to bind: {}", e);
            return;
        }
    };

    println!("[windows-island] Agent WebSocket server listening on {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let app = app.clone();
        tokio::spawn(handle_connection(stream, app));
    }
}

async fn handle_connection(stream: TcpStream, app: AppHandle) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[windows-island] WebSocket handshake failed: {}", e);
            return;
        }
    };

    let (write, mut read) = ws_stream.split();

    // Store write half globally for bidirectional communication
    {
        let mut guard = get_ws_writer().lock().await;
        *guard = Some(write);
    }

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(status) = serde_json::from_str::<AgentStatus>(&text) {
                    let _ = app.emit("agent-status", &status);
                }
            }
            Ok(Message::Ping(data)) => {
                let mut guard = get_ws_writer().lock().await;
                if let Some(sink) = guard.as_mut() {
                    let _ = sink.send(Message::Pong(data)).await;
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }

    // Clean up on disconnect
    {
        let mut guard = get_ws_writer().lock().await;
        *guard = None;
    }
}

/// Write approve/deny response to temp file for island-permission.ps1 to read.
fn write_permission_response(action: &str) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let response_file = temp_dir.join("island-permission-response.txt");
    std::fs::write(&response_file, action)
        .map_err(|e| format!("Failed to write response file: {}", e))
}

/// Type text into the foreground window using Win32 SendInput with Unicode events.
/// This bypasses input methods and works with any language.
#[cfg(target_os = "windows")]
fn type_text_to_foreground(text: &str) {
    use std::mem::size_of;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
        VIRTUAL_KEY,
    };

    let mut inputs: Vec<INPUT> = Vec::new();
    for ch in text.encode_utf16() {
        // Key down
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(0),
                    wScan: ch,
                    dwFlags: KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
        // Key up
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(0),
                    wScan: ch,
                    dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }

    if !inputs.is_empty() {
        unsafe {
            SendInput(&inputs, size_of::<INPUT>() as i32);
        }
    }
}

/// Send Enter key press to the foreground window.
#[cfg(target_os = "windows")]
fn send_key_enter() {
    use std::mem::size_of;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYBD_EVENT_FLAGS,
        VK_RETURN,
    };

    let inputs = [
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_RETURN,
                    wScan: 0,
                    dwFlags: KEYBD_EVENT_FLAGS(0),
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_RETURN,
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
    ];

    unsafe {
        SendInput(&inputs, size_of::<INPUT>() as i32);
    }
}

#[cfg(not(target_os = "windows"))]
fn type_text_to_foreground(_text: &str) {}

#[cfg(not(target_os = "windows"))]
fn send_key_enter() {}
