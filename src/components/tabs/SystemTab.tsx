import type { CSSProperties } from "react";
import { SystemData } from "../../hooks/useSystemData";
import BatteryStatus from "../BatteryStatus";
import NetworkStatus from "../NetworkStatus";
import BluetoothStatus from "../BluetoothStatus";
import VolumeControl from "../VolumeControl";
import BrightnessControl from "../BrightnessControl";

interface Props {
  data: SystemData;
}

const divider: CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  margin: "8px 0",
  background: "rgba(255,255,255,0.08)",
  flexShrink: 0,
};

const cell: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
};

export default function SystemTab({ data }: Props) {
  return (
    <div style={{
      display: "flex",
      alignItems: "stretch",
      height: "100%",
      padding: "0 12px",
    }}>
      <div style={cell}><BatteryStatus info={data.battery} /></div>
      <div style={divider} />
      <div style={cell}><NetworkStatus info={data.wifi} /></div>
      <div style={divider} />
      <div style={cell}><BluetoothStatus enabled={data.bluetooth} /></div>
      <div style={divider} />
      <div style={cell}><VolumeControl volume={data.volume} /></div>
      <div style={divider} />
      <div style={cell}><BrightnessControl brightness={data.brightness} /></div>
    </div>
  );
}
