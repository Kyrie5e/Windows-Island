# Windows-Island 开发者指南

> 本文档面向后续开发者，介绍项目的整体架构、已实现功能、数据流和扩展方法。

---

## 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [项目结构](#项目结构)
4. [架构设计](#架构设计)
5. [已实现功能](#已实现功能)
6. [未完成 / 待优化功能](#未完成--待优化功能)
7. [核心数据流](#核心数据流)
8. [WebSocket 通信协议](#websocket-通信协议)
9. [Claude Code Hooks 集成](#claude-code-hooks-集成)
10. [构建与运行](#构建与运行)
11. [如何扩展](#如何扩展)

---

## 项目概述

**Windows-Island** 是一个仿 macOS Dynamic Island 风格的 Windows 顶部状态条 HUD。

- 平时收缩为屏幕顶部中央的一条短横线（高 4px，宽 30px）
- 鼠标悬停时展开为药丸形状的信息面板（480×156px）
- 支持系统信息、媒体控制、系统通知、AI/Claude Code 状态显示
- 与 Claude Code 深度集成：可接收 AI 状态推送，并直接从面板进行审批/回复操作

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Tauri v2（Rust 后端 + WebView2 前端） |
| 前端 | React + TypeScript，Vite 构建 |
| 动画 | Framer Motion |
| Markdown 渲染 | react-markdown + remark-gfm + react-syntax-highlighter |
| 后端语言 | Rust（2021 edition） |
| Windows API | `windows` crate v0.58 |
| 异步运行时 | Tokio（full features） |
| WebSocket | tokio-tungstenite v0.21 |
| 数据库 | rusqlite（bundled，用于系统通知读取） |
| WMI | wmi crate（用于系统信息查询） |

---

## 项目结构

```
Windows-Island/
├── src/                          # 前端 React/TypeScript
│   ├── main.tsx                  # React 入口，挂载 App
│   ├── App.tsx                   # 根组件：窗口展开/收缩逻辑、事件监听
│   ├── styles/
│   │   └── global.css            # 全局样式（pulse-orange 动画等）
│   ├── lib/
│   │   └── tauri.ts              # 所有 Tauri IPC 调用封装（api 对象）+ 类型定义
│   ├── hooks/
│   │   ├── useSystemData.ts      # 每 3 秒轮询系统数据的 React Hook
│   │   └── useGameMode.ts        # 游戏模式检测（防止悬停展开）
│   └── components/
│       ├── ExpandedPanel.tsx     # 展开面板：Tab 导航 + 内容区
│       ├── AgentResponsePanel.tsx # AI 回复面板：Markdown 渲染 + 滚动阴影 + 展开/折叠
│       ├── BatteryStatus.tsx     # 电池图标组件（SystemTab 内使用）
│       ├── BluetoothStatus.tsx   # 蓝牙图标组件
│       ├── BrightnessControl.tsx # 亮度滑块
│       ├── NetworkStatus.tsx     # WiFi 信号图标
│       ├── VolumeControl.tsx     # 音量滑块
│       └── tabs/
│           ├── SystemTab.tsx     # 系统 Tab：电池、WiFi、音量、亮度、蓝牙
│           ├── MediaTab.tsx      # 媒体 Tab：当前播放歌曲 + 控制按钮
│           ├── MessagesTab.tsx   # 消息 Tab：最新系统通知
│           └── AITab.tsx         # AI Tab：Claude Code 状态 + 交互按钮
│
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml                # Rust 依赖配置
│   ├── tauri.conf.json           # Tauri 窗口/应用配置
│   └── src/
│       ├── main.rs               # 程序入口（调用 lib.rs run()）
│       ├── lib.rs                # Tauri Builder 配置：插件、setup、命令注册
│       ├── config.rs             # 配置常量（如 PILL_WIDTH）
│       ├── window.rs             # 窗口初始化 + 光标追踪器
│       └── commands/
│           ├── mod.rs            # 模块声明
│           ├── agent.rs          # WebSocket 服务器 + 双向通信 + 窗口聚焦
│           ├── battery.rs        # 电池信息（Win32 System_Power）
│           ├── bluetooth.rs      # 蓝牙状态（WinRT Devices_Radios）
│           ├── brightness.rs     # 屏幕亮度（WMI 查询）
│           ├── gamemode.rs       # 游戏模式检测（进程扫描）
│           ├── media.rs          # 媒体会话控制（WinRT Media_Control）
│           ├── network.rs        # WiFi 信息（Win32 NetworkManagement_WiFi）
│           ├── notification.rs   # 系统通知读取（SQLite 读 Windows 通知数据库）
│           ├── volume.rs         # 音量控制（Win32 Media_Audio_Endpoints）
│           └── window.rs         # 窗口调整大小命令
│
├── public/
│   └── sounds/
│       └── notification.wav      # 通知提示音（C5→E5 双音调，约 1 秒）
│
├── scripts/                      # Claude Code 集成脚本（一键安装到 ~/.claude/scripts/）
│   ├── island-notify.ps1         # Stop / PostToolUse hook：推送 idle 状态 + 读取 AI 回复
│   ├── island-permission.ps1     # PreToolUse hook：展示权限审批 UI，轮询用户响应
│   └── install.ps1               # 一键安装脚本：复制脚本 + 写入 Claude Code hooks 配置
│
└── ~/.claude/                    # Claude Code 本地配置（运行 install.ps1 后自动生成）
    ├── scripts/
    │   ├── island-notify.ps1
    │   └── island-permission.ps1
    └── settings.json             # hooks 段由 install.ps1 自动合并写入
```

---

## 架构设计

### 窗口模型

```
屏幕顶部（全宽透明窗口）
┌─────────────────────────────────────────────────────────┐  ← 高 20px（透明 hover 区域）
│              [████] ← 收缩状态的小横条（4px）             │
│  ┌──────────────────────────────────────────────────┐   │
│  │          展开面板（480×156px，深色药丸）           │   │  ← 展开时动态调整窗口高度
│  │  [System] [Media] [Messages] [AI]  ← Tab 导航    │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │           Tab 内容区（120px）              │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- 窗口始终 `always-on-top`，`transparent`，`decorations: false`
- 收缩时高度 = 20px（透明鼠标检测区），展开时 = 184px
- 光标追踪通过 Rust 原生线程每 30ms 轮询 `GetCursorPos`，而非依赖 WebView2 鼠标事件（WebView2 失焦时会停止触发）
- 光标进入/离开通过 Tauri 事件 `cursor-enter` / `cursor-leave` 传递到前端

### IPC 通信模型

```
前端 (React)  ←→  Tauri IPC  ←→  Rust 后端
                  invoke()         commands/
                  listen()         events emit()
```

- **前端 → 后端**：`invoke("command_name", params)` 调用 Rust `#[tauri::command]`
- **后端 → 前端**：`app.emit("event-name", payload)` 触发前端 `listen()` 监听器

---

## 已实现功能

### ✅ 1. 系统状态显示（SystemTab）

| 功能 | 实现方式 |
|------|---------|
| 电池电量 + 充电状态 | `Win32_System_Power::GetSystemPowerStatus` |
| WiFi 连接状态 + SSID + 信号强度 | `Win32_NetworkManagement_WiFi` API |
| 系统音量显示 + 调节 | `Win32_Media_Audio_Endpoints` IAudioEndpointVolume |
| 屏幕亮度显示 + 调节 | WMI `WmiMonitorBrightness` + `WmiMonitorBrightnessMethods` |
| 蓝牙开关状态 | WinRT `Devices::Radios` |

数据每 **3 秒**轮询一次（`useSystemData.ts`），使用 `Promise.allSettled` 并行请求，任一失败不影响其他。

### ✅ 2. 媒体控制（MediaTab）

- 读取 Windows 媒体会话（SMTC），显示当前播放曲目和艺术家
- 支持播放/暂停/上一首/下一首
- 使用 WinRT `Windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager`

### ✅ 3. 系统通知（MessagesTab）

- 读取 Windows 通知数据库（SQLite，路径 `%LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db`）
- 显示最新一条通知（应用名、标题、正文）
- 新通知到来时面板自动展开 2 秒，收缩横条变蓝

### ✅ 4. 游戏模式（Game Mode Guard）

- 检测前台进程是否为全屏游戏（扫描运行进程）
- 游戏模式激活时，鼠标悬停**不触发**面板展开，避免遮挡游戏画面
- `useGameMode.ts` hook 每 5 秒检测一次

### ✅ 5. Claude Code 集成（AITab）

这是本项目的核心扩展功能，分为以下子功能：

#### 5a. 状态接收（WebSocket 服务端）

- Rust 在 `127.0.0.1:27182` 启动 WebSocket TCP 服务器
- Claude Code（或任何客户端）连接后发送 `AgentStatus` JSON：
  ```json
  { "state": "tool_use", "tool": "Bash", "message": "npm run build" }
  ```
- Rust 将其转为 Tauri 事件 `agent-status` 推送给前端
- 前端 `App.tsx` 监听后更新 `agentStatus` 状态

#### 5b. 注意状态自动展开 + 音效

- 当状态为 `waiting_review` 或 `permission_required` 时：
  - 播放 `public/sounds/notification.wav` 提示音
  - 自动展开面板
  - 强制切换到 AI Tab
  - 收缩横条显示脉冲动画（橙色/红色）
  - 锁定面板，移开鼠标不会收缩

#### 5c. 双向交互

- **permission_required**：显示 Approve（绿）/ Always（浅绿，永久放行）/ Deny（红）三个按钮
  - Approve → WebSocket 发回 `{ "action": "approve" }`
  - Always  → WebSocket 发回 `{ "action": "always_allow" }`，并将工具名写入 `settings.local.json` 的 `permissions.allow`
  - Deny    → WebSocket 发回 `{ "action": "deny" }`
- **waiting_review**：显示文本输入框 + Send 按钮
  - 发回 `{ "action": "ask", "message": "用户输入的文字" }`
- **idle**：面板底部始终显示输入框，用户可在查看 AI 回复后直接发起新对话
  - 发送后清除上次 AI 回复面板，通过键盘注入将文本输入到 Claude Code 终端
- 点击面板空白区域调用 `focus_agent_window()`，将终端窗口聚焦到前台

#### 5d. 聚焦终端窗口

- 使用 Win32 `EnumWindows` 遍历所有可见窗口
- 查找标题包含 `"claude"` 的窗口
- 调用 `ShowWindow(SW_RESTORE)` + `SetForegroundWindow`

#### 5e. Claude Code Hooks 自动推送

通过 Claude Code 的 hooks 机制，在工具使用前后自动与 Island 通信：

| Hook 类型 | 触发时机 | 调用脚本 | 效果 |
|-----------|----------|---------|------|
| `PreToolUse` (Bash/Edit/Write) | Claude Code 即将执行工具 | `island-permission.ps1` | 展示权限审批 UI，等待用户响应 |
| `PostToolUse` (所有工具) | 工具执行完毕 | `island-notify.ps1 -State idle` | 通知 Island 回到待机状态 |
| `Stop` | Claude Code 完成整轮对话 | `island-notify.ps1 -State idle -ReadStdin` | 读取 transcript，将 AI 回复摘要推送到面板 |

**两个脚本均已放入仓库 `scripts/` 目录，运行 `scripts\install.ps1` 即可完成配置。**

#### 5f. 权限审批机制

`island-permission.ps1` 收到 PreToolUse 触发后：

1. 读取 stdin 中的工具名和命令
2. 检查 settings.json 的 `permissions.allow` 列表，仅当存在**全局放行规则**（裸工具名如 `Bash` 或通配符 `Bash(*)`）时才跳过 Island UI；作用域规则如 `Bash(npm run:*)` 不会触发快速路径，由 Claude Code 内部匹配
3. 通过 WebSocket 向 Island 发送 `{ state: "permission_required" }` 消息
4. Island 展示 **Approve / Always Allow / Deny** 三个按钮
5. 用户点击后，Island 将响应字符串写入 `%TEMP%\island-permission-response.txt`
6. 脚本轮询该文件（最多等待 120 秒）：
   - `approve` / `cancel` → `exit 0`（允许）
   - `always_allow` → 将工具名写入 `settings.local.json` 的 `permissions.allow`，再 `exit 0`
   - `deny` / 超时 → `exit 2`（Claude Code 阻止该操作）

> ✅ **审批操作纯文件驱动，无键盘注入**，不会污染终端输入。

#### 5g. 键盘注入输入

用户在 AI Tab 输入框键入文字（`waiting_review` 续问或 `idle` 新对话均适用）→ Rust 聚焦终端窗口（查找标题含 `"claude"` 的窗口）→ SendInput 逐字符发送 + Enter。
- 使用 `KEYEVENTF_UNICODE` 标志，绕过输入法，支持中文等多语言输入

#### 5h. AI 回复 Markdown 渲染（AgentResponsePanel）

当 Claude Code `Stop` hook 触发时，`island-notify.ps1` 从 transcript 提取 AI 最后一条回复，通过 WebSocket 发送：

```json
{ "state": "idle", "message": "AI 回复的内容（Markdown 格式）" }
```

前端接收后在 `AITab` 内展示 `AgentResponsePanel` 组件：
- 默认折叠，点击标题展开
- 支持 Markdown 渲染（GFM 表格、列表、引用块等）
- 代码块带语法高亮（tsx/ts/js/py/bash/json/css/rust/powershell）
- 超长内容可滚动（最大高度 300px），顶底带渐变阴影
- 展开时自动调整 Island 窗口高度（+320px）

---

### ❌ 未实现

| 功能 | 说明 |
|------|------|
| 多 Claude Code 实例支持 | 当前 WebSocket 服务器只维护一个全局 writer，多个连接会覆盖 |
| 自定义通知声音 | 目前固定为 `notification.wav`，可添加设置页面 |
| 设置面板 | 无 UI 可配置轮询间隔、主题色等 |
| 历史通知列表 | MessagesTab 只显示最新一条通知 |
| 媒体专辑封面 | MediaTab 不显示专辑封面图片 |
| 多显示器支持 | 当前固定显示在主显示器顶部 |
| 应用托盘图标 | 无系统托盘图标，只能通过任务管理器关闭 |
| 自动启动 | 无开机自启动机制 |
| 字体图标 | 目前用内联 SVG，未引入图标库 |

### ⚠️ 已知问题 / 技术债

| 问题 | 位置 | 说明 |
|------|------|------|
| 系统数据全量轮询 | `useSystemData.ts` | 每 3 秒全量调用 7 个 IPC，应改为事件驱动或按需刷新 |
| WS 只支持单连接 | `agent.rs WS_WRITER` | 新连接会覆盖旧连接的 writer，不支持并发 |
| 通知读取可能被 Windows 锁 | `notification.rs` | 直接读 SQLite 可能在数据库锁定时失败，需 retry 机制 |
| 无测试覆盖 | 整个项目 | 前端无单元测试，后端无集成测试 |
| `focus_agent_window` 匹配规则简单 | `agent.rs` | 仅匹配标题含 "claude"，可能误匹配其他窗口 |

---

## 核心数据流

### 系统数据流

```
Rust commands/          →  Tauri IPC invoke()  →  useSystemData.ts  →  ExpandedPanel  →  各 Tab
battery.rs get_battery                             每 3 秒轮询           data prop
network.rs get_wifi
volume.rs get_volume
...
```

### Claude Code 状态流

```
Claude Code              PowerShell              Rust WS Server           前端
    │   PreToolUse hook      │                       │                      │
    │──────────────────────→│  island-notify.ps1     │                      │
    │                        │──── WS JSON ─────────→│                      │
    │                        │                       │── emit("agent-status")→│
    │                        │                       │                      │── setAgentStatus()
    │                        │                       │                      │── 展开面板 + 播放音效
    │                        │                       │                      │
    │                        │    ←─── WS JSON ──────│←── sendAgentResponse()│
    │← (未来: 读取 WS 响应) ─│                       │   action/message     │
```

### 鼠标悬停流

```
Win32 GetCursorPos (30ms 轮询)
    │
    ├── cursor inside window → emit("cursor-enter") → doExpand() → resizeWindow(184)
    └── cursor outside window → emit("cursor-leave") → doCollapse() → resizeWindow(20)
                                                            ↑
                                              注意状态时 doCollapse() 被阻断
```

---

## WebSocket 通信协议

### 服务端地址

`ws://127.0.0.1:27182`

### 入站消息（客户端 → Windows-Island）

```typescript
interface AgentStatus {
  state: "idle" | "tool_use" | "waiting_review" | "permission_required";
  tool?: string;    // state = "tool_use" 时填写工具名
  message?: string; // 可选附加说明
}
```

示例：
```json
{ "state": "tool_use", "tool": "Bash", "message": "cargo build" }
{ "state": "waiting_review", "message": "请确认这段代码是否正确" }
{ "state": "permission_required", "message": "需要执行 rm -rf，请批准" }
{ "state": "idle" }
```

### 出站消息（Windows-Island → 客户端）

```typescript
interface AgentResponse {
  action: "approve" | "always_allow" | "deny" | "ask" | "cancel";
  message?: string; // action = "ask" 时填写用户输入
}
```

示例：
```json
{ "action": "approve" }
{ "action": "always_allow" }
{ "action": "deny" }
{ "action": "ask", "message": "请帮我把注释也翻译成中文" }
```

---

## Claude Code Hooks 集成

### 脚本说明

仓库 `scripts/` 目录包含两个 Hook 脚本和一个安装程序：

| 文件 | 说明 |
|------|------|
| `island-notify.ps1` | 接收 `-State` 参数，通过 WebSocket 向 Island 推送状态；`-ReadStdin` 模式下从 transcript 提取 AI 回复 |
| `island-permission.ps1` | PreToolUse hook，向 Island 展示权限审批 UI，轮询用户响应并以退出码控制 Claude Code |
| `install.ps1` | 一键安装：复制脚本到 `~/.claude/scripts/`，合并 hooks 配置到 `~/.claude/settings.json` |

### 快速安装

```powershell
# 在仓库根目录执行
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

安装完成后即可启动 Windows-Island，Claude Code 会自动对接。

### 手动配置（可选）

如需手动配置，将以下 `hooks` 段合并到 `~/.claude/settings.json`，把 `<USERNAME>` 替换为你的 Windows 用户名：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -File \"C:/Users/<USERNAME>/.claude/scripts/island-permission.ps1\"" }]
      },
      {
        "matcher": "Edit",
        "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -File \"C:/Users/<USERNAME>/.claude/scripts/island-permission.ps1\"" }]
      },
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -File \"C:/Users/<USERNAME>/.claude/scripts/island-permission.ps1\"" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -File \"C:/Users/<USERNAME>/.claude/scripts/island-notify.ps1\" -State idle" }]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "powershell.exe -NoProfile -File \"C:/Users/<USERNAME>/.claude/scripts/island-notify.ps1\" -State idle -ReadStdin" }]
      }
    ]
  }
}
```

### 各 Hook 职责

| Hook | 脚本 | 行为 |
|------|------|------|
| `PreToolUse` Bash/Edit/Write | `island-permission.ps1` | 展示审批 UI；`exit 0` 放行，`exit 2` 拒绝 |
| `PostToolUse` 全部 | `island-notify.ps1 -State idle` | 推送 idle 状态 |
| `Stop` | `island-notify.ps1 -State idle -ReadStdin` | 读取 AI 回复摘要并推送，触发面板弹出展示结果 |

---

## 构建与运行

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI](https://tauri.app/) — 通过 npm 安装即可
- [Claude Code](https://claude.ai/download)（可选，AI Tab 集成需要）

### 安装依赖

```bash
npm install
```

### 配置 Claude Code 集成（可选但推荐）

```powershell
# 在仓库根目录执行，自动完成脚本复制 + hooks 配置
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

> 如果遇到执行策略限制，先运行：`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

### 开发模式（热重载）

```bash
npm run tauri dev
```

启动后会打开一个透明的顶部 HUD 窗口。开发期间建议用 F12 打开 DevTools（需在 `tauri.conf.json` 开启 `devtools: true`）。

### 生产构建

```bash
npm run tauri build
```

输出在 `src-tauri/target/release/` 目录下。

### 测试 WebSocket 推送

```bash
# 安装 wscat（如未安装）
npm install -g wscat

# 连接到 Windows-Island
wscat -c ws://127.0.0.1:27182

# 发送测试消息
{"state":"waiting_review","message":"请确认这个操作"}
{"state":"permission_required","message":"需要删除文件"}
{"state":"tool_use","tool":"Bash","message":"cargo build"}
{"state":"idle"}
```

---

## 如何扩展

### 添加新的 Rust 命令

1. 在 `src-tauri/src/commands/` 创建新文件（如 `cpu.rs`）
2. 实现 `#[tauri::command]` 函数
3. 在 `commands/mod.rs` 中 `pub mod cpu;`
4. 在 `lib.rs` 的 `invoke_handler![]` 宏中注册

```rust
// commands/cpu.rs
#[tauri::command]
pub fn get_cpu_usage() -> f32 {
    // Win32 implementation...
    0.0
}
```

### 添加新的前端 API

在 `src/lib/tauri.ts` 的 `api` 对象中添加：

```typescript
getCpuUsage: () => invoke<number>("get_cpu_usage"),
```

### 添加新的 Tab

1. 创建 `src/components/tabs/CpuTab.tsx`
2. 在 `ExpandedPanel.tsx` 的 `TABS` 数组中添加 `{ id: "cpu", label: "CPU" }`
3. 在 `TabId` 类型中添加 `"cpu"`
4. 在内容区 `{activeTab === "cpu" && <CpuTab ... />}` 中渲染

### 在 `useSystemData` 中添加新数据

```typescript
// useSystemData.ts
const [battery, wifi, volume, brightness, bluetooth, media, notification, cpu] =
  await Promise.allSettled([
    api.getBattery(),
    // ...
    api.getCpuUsage(),  // 新增
  ]);
```

### 添加新的 Tauri 事件监听

```typescript
// App.tsx
useEffect(() => {
  const unlisten = listen<SomePayload>("my-event", (event) => {
    // 处理事件
  });
  return () => { unlisten.then(f => f()); };
}, []);
```

---

## 关键文件速查

| 想修改 | 看这个文件 |
|--------|-----------|
| 面板展开/收缩逻辑 | `src/App.tsx` |
| Tab 导航和布局 | `src/components/ExpandedPanel.tsx` |
| Claude Code AI 状态显示 | `src/components/tabs/AITab.tsx` |
| AI 回复 Markdown 渲染 | `src/components/AgentResponsePanel.tsx` |
| 系统数据轮询 | `src/hooks/useSystemData.ts` |
| 所有前端 API 调用 | `src/lib/tauri.ts` |
| WebSocket 服务器 + 双向通信 | `src-tauri/src/commands/agent.rs` |
| 窗口初始化 + 光标追踪 | `src-tauri/src/window.rs` |
| 所有命令注册 | `src-tauri/src/lib.rs` |
| 全局样式（动画等） | `src/styles/global.css` |
