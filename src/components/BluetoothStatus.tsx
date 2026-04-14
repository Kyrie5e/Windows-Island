interface Props {
  enabled: boolean;
}

export default function BluetoothStatus({ enabled }: Props) {
  const color = enabled ? "#0a84ff" : "rgba(255,255,255,0.25)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="14" height="18" viewBox="0 0 12 20" fill="none">
        <path
          d="M2 5 L10 13 L6 17 L6 3 L10 7 L2 15"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ color, fontSize: 11 }}>{enabled ? "开" : "关"}</span>
    </div>
  );
}
