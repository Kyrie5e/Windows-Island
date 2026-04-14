import { useState } from "react";
import { api } from "../lib/tauri";

interface Props {
  volume: number;
}

export default function VolumeControl({ volume }: Props) {
  const [localVol, setLocalVol] = useState<number | null>(null);
  const displayed = localVol !== null ? localVol : volume;
  const pct = Math.round(displayed * 100);

  const isMuted = pct === 0;
  const isLow = pct < 40;
  const iconColor = "rgba(255,255,255,0.75)";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setLocalVol(val);
    api.setVolume(val).catch(() => {});
  }

  function handleMouseUp() {
    setLocalVol(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="20" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round">
        {isMuted ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={iconColor} stroke="none" opacity="0.4" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : isLow ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={iconColor} stroke="none" opacity="0.7" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={iconColor} stroke="none" opacity="0.85" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1 }}>{pct}%</span>
      <input
        type="range"
        min={0} max={1} step={0.02}
        value={displayed}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        style={{ width: "100%", maxWidth: 80 }}
      />
    </div>
  );
}
