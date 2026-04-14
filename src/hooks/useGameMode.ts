import { useEffect, useState } from "react";
import { api, GameModeStatus } from "../lib/tauri";

export function useGameMode() {
  const [status, setStatus] = useState<GameModeStatus>({ active: false, reason: "" });

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const result = await api.isGameMode();
        if (alive) setStatus(result);
      } catch (_) {}
    }

    check();
    const interval = setInterval(check, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return status;
}
