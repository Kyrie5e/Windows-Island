import { useState } from "react";
import { api, BrightnessInfo } from "../lib/tauri";

interface Props {
  brightness: BrightnessInfo | null;
}

export default function BrightnessControl({ brightness }: Props) {
  const [localVal, setLocalVal] = useState<number | null>(null);

  if (!brightness) return null;

  if (!brightness.supported) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>不支持</span>
      </div>
    );
  }

  const displayed = localVal !== null ? localVal : brightness.level;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    setLocalVal(val);
    api.setBrightness(val).catch(() => {});
  }

  function handleMouseUp() {
    setLocalVal(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1 }}>{displayed}%</span>
      <input
        type="range"
        min={0} max={100} step={5}
        value={displayed}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        style={{ width: "100%", maxWidth: 80 }}
      />
    </div>
  );
}
