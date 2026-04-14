import { invoke } from "@tauri-apps/api/core";

export interface BatteryInfo {
  percent: number;
  charging: boolean;
  no_battery: boolean;
}

export interface WifiInfo {
  connected: boolean;
  ssid: string;
  signal: number;
}

export interface MediaInfo {
  title: string;
  artist: string;
  playing: boolean;
  has_session: boolean;
}

export interface BrightnessInfo {
  level: number;
  supported: boolean;
}

export interface NotificationInfo {
  app: string;
  title: string;
  body: string;
}

export interface GameModeStatus {
  active: boolean;
  reason: string;
}

export interface AgentStatus {
  state: "idle" | "tool_use" | "waiting_review" | "permission_required";
  tool?: string;
  message?: string;
}

export const api = {
  getVolume: () => invoke<number>("get_volume"),
  setVolume: (level: number) => invoke<void>("set_volume", { level }),
  getBrightness: () => invoke<BrightnessInfo>("get_brightness"),
  setBrightness: (level: number) => invoke<void>("set_brightness", { level }),
  getBattery: () => invoke<BatteryInfo>("get_battery"),
  getWifi: () => invoke<WifiInfo>("get_wifi"),
  getBluetooth: () => invoke<boolean>("get_bluetooth"),
  getMedia: () => invoke<MediaInfo>("get_media"),
  mediaControl: (action: "play" | "pause" | "next" | "prev") =>
    invoke<void>("media_control", { action }),
  getLatestNotification: () =>
    invoke<NotificationInfo | null>("get_latest_notification"),
  isGameMode: () => invoke<GameModeStatus>("is_game_mode"),
  resizeWindow: (height: number) => invoke<void>("resize_window", { height }),
  sendAgentResponse: (action: string, message?: string) =>
    invoke<void>("send_agent_response", { action, message: message ?? null }),
  /** Cancel a pending permission prompt that was auto-approved by Claude Code (no keyboard injection). */
  cancelPermission: () =>
    invoke<void>("send_agent_response", { action: "cancel", message: null }),
  focusAgentWindow: () => invoke<void>("focus_agent_window"),
};
