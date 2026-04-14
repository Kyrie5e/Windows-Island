import { useEffect, useRef, useState } from "react";
import {
  api,
  BatteryInfo,
  WifiInfo,
  MediaInfo,
  BrightnessInfo,
  NotificationInfo,
} from "../lib/tauri";

export interface SystemData {
  battery: BatteryInfo | null;
  wifi: WifiInfo | null;
  volume: number;
  brightness: BrightnessInfo | null;
  bluetooth: boolean;
  media: MediaInfo | null;
  notification: NotificationInfo | null;
  newNotification: boolean;
}

export function useSystemData() {
  const [data, setData] = useState<SystemData>({
    battery: null,
    wifi: null,
    volume: 0,
    brightness: null,
    bluetooth: false,
    media: null,
    notification: null,
    newNotification: false,
  });

  const lastNotifRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchAll() {
      try {
        const [battery, wifi, volume, brightness, bluetooth, media, notification] =
          await Promise.allSettled([
            api.getBattery(),
            api.getWifi(),
            api.getVolume(),
            api.getBrightness(),
            api.getBluetooth(),
            api.getMedia(),
            api.getLatestNotification(),
          ]);

        if (!alive) return;

        setData((prev) => {
          const notif =
            notification.status === "fulfilled" ? notification.value : prev.notification;
          const notifKey = notif ? `${notif.app}:${notif.title}` : null;
          const isNew = notifKey !== null && notifKey !== lastNotifRef.current;
          if (isNew) lastNotifRef.current = notifKey;

          return {
            battery:
              battery.status === "fulfilled" ? battery.value : prev.battery,
            wifi: wifi.status === "fulfilled" ? wifi.value : prev.wifi,
            volume:
              volume.status === "fulfilled" ? volume.value : prev.volume,
            brightness:
              brightness.status === "fulfilled"
                ? brightness.value
                : prev.brightness,
            bluetooth:
              bluetooth.status === "fulfilled"
                ? bluetooth.value
                : prev.bluetooth,
            media: media.status === "fulfilled" ? media.value : prev.media,
            notification: notif,
            newNotification: isNew,
          };
        });
      } catch (_) {}
    }

    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  function clearNewNotification() {
    setData((prev) => ({ ...prev, newNotification: false }));
  }

  return { data, clearNewNotification };
}
