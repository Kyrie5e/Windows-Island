import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { api, AgentStatus } from "./lib/tauri";
import { useSystemData } from "./hooks/useSystemData";
import { useGameMode } from "./hooks/useGameMode";
import ExpandedPanel from "./components/ExpandedPanel";

const COLLAPSED_HEIGHT = 4;
const HOVER_ZONE = 20; // Transparent hit area for mouse detection
const EXPANDED_HEIGHT = 184; // 20(hover) + 4(gap) + 36(tab bar) + 120(content) + 4(bottom padding)
const BAR_WIDTH = 30;
const BAR_PANEL_GAP = 4;
const COLLAPSE_DELAY = 300;

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ state: "idle" });
  const [forceAITab, setForceAITab] = useState(false);
  const [lastAgentMessage, setLastAgentMessage] = useState<string | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifAudio = useRef<HTMLAudioElement | null>(null);

  const gameMode = useGameMode();
  const { data, clearNewNotification } = useSystemData();

  // Refs to avoid stale closures in Tauri event listeners
  const gameModeActiveRef = useRef(false);
  gameModeActiveRef.current = gameMode.active;

  const agentStateRef = useRef<AgentStatus["state"]>("idle");
  agentStateRef.current = agentStatus.state;

  useEffect(() => {
    const unlisten = listen<AgentStatus>("agent-status", (event) => {
      const prevState = agentStateRef.current;
      setAgentStatus(event.payload);

      // Capture completed message when idle arrives with a message (sent by Stop hook).
      // Don't require prevState !== "idle" — PostToolUse may have already sent an idle
      // before the Stop hook fires with the actual completion message.
      const hasCompletionMessage =
        event.payload.state === "idle" &&
        event.payload.message;

      if (hasCompletionMessage) {
        setLastAgentMessage(event.payload.message!);
      }

      const isAttentionState =
        event.payload.state === "waiting_review" ||
        event.payload.state === "permission_required";
      if (isAttentionState) {
        // Play notification sound
        if (!notifAudio.current) {
          notifAudio.current = new Audio("/sounds/notification.wav");
        }
        notifAudio.current.currentTime = 0;
        notifAudio.current.play().catch(() => {});
        // Force expand and switch to AI tab
        setForceAITab(true);
        doExpand();
        if (collapseTimer.current) clearTimeout(collapseTimer.current);
      } else if (hasCompletionMessage) {
        // Agent completed with a response message — keep panel open on AI tab
        setForceAITab(true);
        doExpand();
        if (collapseTimer.current) clearTimeout(collapseTimer.current);
      } else {
        // Normal state transition (tool_use ↔ idle without message)
        setForceAITab(false);
        // If Claude Code auto-approved a tool that was already allowed,
        // cancel the pending island-permission.ps1 polling loop via the file.
        if (prevState === "permission_required") {
          api.cancelPermission().catch(() => {});
        }
        // Collapse when state returns to idle/tool_use without a completion message
        doCollapse(true);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // Native cursor tracking from Rust — works even when WebView2 is unfocused
  useEffect(() => {
    const enterUnlisten = listen("cursor-enter", () => {
      if (gameModeActiveRef.current) return;
      doExpand();
    });
    const leaveUnlisten = listen("cursor-leave", () => {
      doCollapse();
    });
    return () => {
      enterUnlisten.then((f) => f());
      leaveUnlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (data.newNotification && !gameMode.active) {
      doExpand();
      if (forceExpandTimer.current) clearTimeout(forceExpandTimer.current);
      forceExpandTimer.current = setTimeout(() => {
        doCollapse();
        clearNewNotification();
      }, 2000);
    }
  }, [data.newNotification]);

  function doExpand() {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setExpanded(true);
    api.resizeWindow(EXPANDED_HEIGHT).catch(() => {});
  }

  function doCollapse(force = false) {
    if (
      !force &&
      (agentStateRef.current === "waiting_review" ||
        agentStateRef.current === "permission_required")
    ) return;
    collapseTimer.current = setTimeout(() => {
      setExpanded(false);
      api.resizeWindow(HOVER_ZONE).catch(() => {});
    }, COLLAPSE_DELAY);
  }

  // Called when user responds to agent (Send / Approve / Deny) in AITab
  function handleAgentResponded() {
    setAgentStatus({ state: "idle" });
    setForceAITab(false);
    doCollapse(true); // force=true: bypass the attention-state guard since user already responded
  }

  // Top collapsed bar — always visible
  const barColor =
    agentStatus.state === "permission_required" ? "#ff3b30" :
    agentStatus.state === "waiting_review" ? "#ff8c00" :
    data.newNotification ? "#0a84ff" : "#1a1a1a";

  const isAttention =
    agentStatus.state === "waiting_review" ||
    agentStatus.state === "permission_required";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Collapsed bar — short centered line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: BAR_WIDTH,
          height: COLLAPSED_HEIGHT,
          backgroundColor: barColor,
          transition: "background-color 0.3s ease",
          animation: isAttention ? "pulse-orange 1s ease-in-out infinite" : undefined,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
      </div>

      {/* Expanded pill panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scaleY: 0.85, y: -2 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.85, y: -2 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: COLLAPSED_HEIGHT + BAR_PANEL_GAP,
              left: 0,
              right: 0,
              transformOrigin: "top center",
            }}
          >
            <ExpandedPanel data={data} agentStatus={agentStatus} forceAITab={forceAITab} onAgentResponded={handleAgentResponded} lastAgentMessage={lastAgentMessage} onClearAgentMessage={() => setLastAgentMessage(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
