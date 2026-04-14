import { WifiInfo } from "../lib/tauri";

interface Props {
  info: WifiInfo | null;
}

function WifiIcon({ signal, connected }: { signal: number; connected: boolean }) {
  const bars = connected ? (signal >= 75 ? 3 : signal >= 45 ? 2 : 1) : 0;
  const dim = "rgba(255,255,255,0.18)";
  const lit = "rgba(255,255,255,0.85)";
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
      <path d="M8 11.5 L8 12.5" stroke={bars >= 1 ? lit : dim} strokeWidth="2" strokeLinecap="round" />
      <path d="M5.2 9 Q8 6.5 10.8 9" stroke={bars >= 2 ? lit : dim} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M2.5 6.5 Q8 2 13.5 6.5" stroke={bars >= 3 ? lit : dim} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function NetworkStatus({ info }: Props) {
  if (!info || !info.connected) {
    const ssid = !info ? "—" : "未连接";
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <WifiIcon signal={0} connected={false} />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{ssid}</span>
      </div>
    );
  }

  const ssid = info.ssid.length > 10 ? info.ssid.slice(0, 10) + "…" : info.ssid;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <WifiIcon signal={info.signal} connected={true} />
      <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>{ssid}</span>
    </div>
  );
}
