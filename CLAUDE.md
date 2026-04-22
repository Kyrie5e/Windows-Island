# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev mode (hot reload — Vite + Rust together)
npm run tauri dev

# Production build
npm run tauri build

# Fast Rust type check (no full rebuild)
cd src-tauri && cargo check

# TypeScript type check only
npx tsc --noEmit
```

If `npm run tauri dev` fails with "Port 1420 already in use", find and kill the conflicting processes:
```bash
netstat -ano | grep -E "1420|27182"
taskkill //PID <pid> //F   # use // not / in Git Bash
```

## Architecture

### Overview

Windows-only Tauri 2.x app: a transparent, always-on-top HUD at the top of the screen. Collapses to a 4px bar; expands to a 480×156px dark pill on hover.

**Data flow:**
- Frontend → Backend: `invoke("command_name", params)` via the `api` object in `src/lib/tauri.ts`
- Backend → Frontend: `app.emit("event-name", payload)` listened to in `App.tsx`
- All IPC wrappers live in `src/lib/tauri.ts` — always add new commands there

### Window Model

The Tauri window is always 480px wide; height is dynamically set via `resize_window` command:
- Collapsed: 20px (transparent hover zone)
- Expanded: 184px
- Expanded + AI response panel open: up to 504px

Window is `focus: false` at startup, `always_on_top`, no decorations, no taskbar entry.

### Cursor Tracking

Cursor enter/leave is detected by a **native Rust thread** polling `GetCursorPos` every 30ms (not WebView2 mouse events, which stop firing when unfocused). Events arrive in `App.tsx` as `cursor-enter` / `cursor-leave`.

### Claude Code Integration (AITab + agent.rs)

The app acts as a UI companion for Claude Code via two mechanisms:

**1. WebSocket server** (`ws://127.0.0.1:27182`, `commands/agent.rs`):
- Claude Code's PowerShell hooks send `AgentStatus` JSON: `{ state, tool?, message? }`
- Rust parses and re-emits as `agent-status` Tauri event → `App.tsx` updates state
- States: `idle | tool_use | waiting_review | permission_required`
- `waiting_review` / `permission_required` → panel auto-expands, plays sound, locks open

**2. File-based permission response** (`%TEMP%\island-permission-response.txt`):
- Approve/Always/Deny write a response string to this file
- The PowerShell hook `island-permission.ps1` polls the file and exits with code 0 or 2
- No keyboard injection for permission responses

**Sending messages to Claude Code terminal** (`"ask"` action):
- Uses `SendInput` with `KEYEVENTF_UNICODE` (supports CJK/non-ASCII)
- Flow: save foreground window → `SetForegroundWindow(claude_hwnd)` → `SendInput` → restore foreground
- `find_agent_window()` matches visible window titles containing `"claude"` (case-insensitive)

### Win32 / Async Constraint

`HWND` and other Win32 handle types are `!Send`. **Never hold them across `.await` boundaries.** Store as `isize` before awaiting, reconstruct after:
```rust
let saved_raw = unsafe { GetForegroundWindow().0 as isize };
tokio::time::sleep(...).await;
let saved_hwnd = HWND(saved_raw as *mut _);
```

### Rust Command Registration

To add a new backend command:
1. Implement `#[tauri::command]` in `src-tauri/src/commands/<module>.rs`
2. Declare the module in `commands/mod.rs`
3. Register in `lib.rs` inside `tauri::generate_handler![]`
4. Add a typed wrapper in `src/lib/tauri.ts` `api` object

### Key Files

| What | Where |
|------|-------|
| All IPC calls + type definitions | `src/lib/tauri.ts` |
| Panel expand/collapse, agent state | `src/App.tsx` |
| Tab layout, window resize on panel toggle | `src/components/ExpandedPanel.tsx` |
| AI status + send/approve/deny UI | `src/components/tabs/AITab.tsx` |
| AI reply Markdown panel | `src/components/AgentResponsePanel.tsx` |
| System data polling (3s interval) | `src/hooks/useSystemData.ts` |
| WebSocket server + keyboard injection | `src-tauri/src/commands/agent.rs` |
| Window init + cursor tracker | `src-tauri/src/window.rs` |
| Tauri builder + command registration | `src-tauri/src/lib.rs` |
| Claude Code hook scripts | `scripts/island-notify.ps1`, `scripts/island-permission.ps1` |

### No Test Infrastructure

There are no unit or integration tests in this project.

## Rule

1、每成功完成一次功能模块的添加或者修改就针对README.md和DEVELOPER_GUIDE.md进行修改，并将项目同步到github上
