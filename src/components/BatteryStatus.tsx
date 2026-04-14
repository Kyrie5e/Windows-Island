import { BatteryInfo } from "../lib/tauri";

interface Props {
  info: BatteryInfo | null;
}

export default function BatteryStatus({ info }: Props) {
  if (!info || info.no_battery) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8">
          <rect x="2" y="7" width="18" height="10" rx="2" />
          <path d="M22 11v2" strokeLinecap="round" />
          <line x1="2" y1="2" x2="22" y2="22" stroke="rgba(255,80,80,0.6)" strokeWidth="1.5" />
        </svg>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>—</span>
      </div>
    );
  }

  const { percent, charging } = info;
  const isLow = percent < 20 && !charging;

  const color = isLow ? "#ff3b30" : charging ? "#30d158" : "rgba(255,255,255,0.85)";
  const fillWidth = Math.max(1, (percent / 100) * 11);
  const fillColor = isLow ? "#ff3b30" : charging ? "#30d158" : "rgba(255,255,255,0.85)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="24" height="16" viewBox="0 0 20 14" fill="none">
        <rect x="1" y="2" width="15" height="10" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" />
        <rect x="2.5" y="3.5" width={fillWidth} height="7" rx="1" fill={fillColor}
          style={{ animation: charging ? "charging 1.2s ease-in-out infinite" : undefined }} />
        <path d="M17 5v4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />
        {charging && (
          <text x="8.5" y="10" fontSize="7" fill="#fff" textAnchor="middle" fontWeight="700">⚡</text>
        )}
      </svg>
      <span style={{ color, fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: isLow ? 600 : 400 }}>
        {percent}%
      </span>
    </div>
  );
}
