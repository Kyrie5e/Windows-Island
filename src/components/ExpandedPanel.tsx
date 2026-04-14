import { useState, useEffect, useCallback } from "react";
import { SystemData } from "../hooks/useSystemData";
import { AgentStatus, api } from "../lib/tauri";
import SystemTab from "./tabs/SystemTab";
import MediaTab from "./tabs/MediaTab";
import MessagesTab from "./tabs/MessagesTab";
import AITab from "./tabs/AITab";

interface Props {
  data: SystemData;
  agentStatus: AgentStatus;
  forceAITab?: boolean;
  onAgentResponded?: () => void;
  lastAgentMessage?: string | null;
  onClearAgentMessage?: () => void;
}

type TabId = "system" | "media" | "messages" | "ai";

const TABS: { id: TabId; label: string }[] = [
  { id: "system", label: "System" },
  { id: "media", label: "Media" },
  { id: "messages", label: "Messages" },
  { id: "ai", label: "AI" },
];

const BASE_PANEL_HEIGHT = 156;
const RESPONSE_PANEL_EXTRA = 220; // max-height(200) + header(24) - some overlap
const HOVER_ZONE = 20;
const COLLAPSED_HEIGHT_GAP = 8; // 4(bar) + 4(gap)

export default function ExpandedPanel({ data, agentStatus, forceAITab, onAgentResponded, lastAgentMessage, onClearAgentMessage }: Props) {
  // Default to AI tab when there's a pending agent response to show
  const [activeTab, setActiveTab] = useState<TabId>(lastAgentMessage ? "ai" : "system");
  const [responsePanelExpanded, setResponsePanelExpanded] = useState(false);

  useEffect(() => {
    if (forceAITab || lastAgentMessage) {
      setActiveTab("ai");
    }
  }, [forceAITab, lastAgentMessage]);

  const handleResponsePanelToggle = useCallback((expanded: boolean) => {
    setResponsePanelExpanded(expanded);
    const panelHeight = expanded
      ? BASE_PANEL_HEIGHT + RESPONSE_PANEL_EXTRA
      : BASE_PANEL_HEIGHT;
    api.resizeWindow(HOVER_ZONE + COLLAPSED_HEIGHT_GAP + panelHeight).catch(() => {});
  }, []);

  // Reset response panel state when switching away from AI tab or clearing message
  useEffect(() => {
    if (activeTab !== "ai" || !lastAgentMessage) {
      if (responsePanelExpanded) {
        setResponsePanelExpanded(false);
        api.resizeWindow(HOVER_ZONE + COLLAPSED_HEIGHT_GAP + BASE_PANEL_HEIGHT).catch(() => {});
      }
    }
  }, [activeTab, lastAgentMessage]);

  const panelHeight = responsePanelExpanded && activeTab === "ai"
    ? BASE_PANEL_HEIGHT + RESPONSE_PANEL_EXTRA
    : BASE_PANEL_HEIGHT;

  return (
    <div style={{
      margin: "0 auto",
      width: 480,
      height: panelHeight,
      background: "#111111",
      borderRadius: 28,
      display: "flex",
      flexDirection: "column",
      color: "#fff",
      fontSize: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      overflow: "hidden",
      transition: "height 0.2s ease",
    }}>
      {/* Tab navigation bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        height: 36,
        padding: "0 16px",
        gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0 12px",
              height: 36,
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)",
              borderBottom: activeTab === tab.id ? "2px solid #fff" : "2px solid transparent",
              borderRadius: 0,
              transition: "all 0.2s",
              background: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content area */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 8px" }}>
        {activeTab === "system" && <SystemTab data={data} />}
        {activeTab === "media" && <MediaTab media={data.media} />}
        {activeTab === "messages" && <MessagesTab notification={data.notification} />}
        {activeTab === "ai" && <AITab status={agentStatus} onResponded={onAgentResponded} lastAgentMessage={lastAgentMessage} onClearAgentMessage={onClearAgentMessage} onResponsePanelToggle={handleResponsePanelToggle} />}
      </div>
    </div>
  );
}
