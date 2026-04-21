import { useState } from "react";
import { AgentStatus, api } from "../../lib/tauri";
import AgentResponsePanel from "../AgentResponsePanel";

interface Props {
  status: AgentStatus;
  onResponded?: () => void;
  lastAgentMessage?: string | null;
  onClearAgentMessage?: () => void;
  onResponsePanelToggle?: (expanded: boolean) => void;
}

const STATE_LABEL: Record<AgentStatus["state"], string> = {
  idle: "Idle",
  tool_use: "Running",
  waiting_review: "Waiting for Review",
  permission_required: "Permission Required",
};

const STATE_COLOR: Record<AgentStatus["state"], string> = {
  idle: "rgba(255,255,255,0.35)",
  tool_use: "#30d158",
  waiting_review: "#ff8c00",
  permission_required: "#ff3b30",
};

const STATE_DOT: Record<AgentStatus["state"], string> = {
  idle: "rgba(255,255,255,0.2)",
  tool_use: "#30d158",
  waiting_review: "#ff8c00",
  permission_required: "#ff3b30",
};

function AgentIcon({ state }: { state: AgentStatus["state"] }) {
  const color = STATE_COLOR[state];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M12 2a4 4 0 0 1 4 4v5H8V6a4 4 0 0 1 4-4z" />
      <circle cx="9" cy="17" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="17" r="1" fill={color} stroke="none" />
    </svg>
  );
}

export default function AITab({ status, onResponded, lastAgentMessage, onClearAgentMessage, onResponsePanelToggle }: Props) {
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const isAttention = status.state === "waiting_review" || status.state === "permission_required";

  const handleApprove = async () => {
    setSending(true);
    await api.sendAgentResponse("approve").catch(() => {});
    setSending(false);
    onResponded?.();
  };

  const handleAlwaysAllow = async () => {
    setSending(true);
    await api.sendAgentResponse("always_allow").catch(() => {});
    setSending(false);
    onResponded?.();
  };

  const handleDeny = async () => {
    setSending(true);
    await api.sendAgentResponse("deny").catch(() => {});
    setSending(false);
    onResponded?.();
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    setSending(true);
    await api.sendAgentResponse("ask", inputText.trim()).catch(() => {});
    setInputText("");
    setSending(false);
    onResponded?.();
  };

  const handleFocus = () => {
    api.focusAgentWindow().catch(() => {});
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px 16px 8px", gap: 6 }}
    >
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          onClick={handleFocus}
          style={{
            animation: isAttention ? "pulse-orange 1s ease-in-out infinite" : undefined,
            flexShrink: 0,
            cursor: "pointer",
          }}
          title="Focus Claude Code"
        >
          <AgentIcon state={status.state} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: STATE_DOT[status.state],
              animation: status.state === "tool_use" ? "pulse-orange 1.5s ease-in-out infinite" : undefined,
              flexShrink: 0,
            }} />
            <span style={{
              color: STATE_COLOR[status.state],
              fontSize: 13,
              fontWeight: isAttention ? 600 : 500,
              animation: isAttention ? "pulse-orange 1s ease-in-out infinite" : undefined,
            }}>
              {STATE_LABEL[status.state]}
            </span>
          </div>

          {status.state === "tool_use" && status.tool && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginLeft: 13, marginTop: 2 }}>
              Tool: {status.tool}
            </div>
          )}
        </div>
      </div>

      {/* Message display — hide for idle (handled by AgentResponsePanel below) */}
      {status.message && status.state !== "idle" && (
        <div style={{
          color: "rgba(255,255,255,0.5)", fontSize: 11,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          lineHeight: "15px",
        }}>
          {status.message}
        </div>
      )}

      {/* Permission buttons */}
      {status.state === "permission_required" && (
        <div
          style={{ display: "flex", gap: 6, marginTop: "auto" }}
        >
          <button
            onClick={handleApprove}
            disabled={sending}
            style={{
              flex: 1, height: 26, borderRadius: 13,
              background: "#30d158", color: "#000",
              fontSize: 11, fontWeight: 600,
              border: "none", cursor: "pointer",
              opacity: sending ? 0.5 : 1,
            }}
          >
            Approve
          </button>
          <button
            onClick={handleAlwaysAllow}
            disabled={sending}
            style={{
              flex: 1, height: 26, borderRadius: 13,
              background: "rgba(48,209,88,0.15)", color: "#30d158",
              fontSize: 11, fontWeight: 600,
              border: "1px solid rgba(48,209,88,0.3)", cursor: "pointer",
              opacity: sending ? 0.5 : 1,
            }}
          >
            Always
          </button>
          <button
            onClick={handleDeny}
            disabled={sending}
            style={{
              flex: 1, height: 26, borderRadius: 13,
              background: "rgba(255,59,48,0.2)", color: "#ff3b30",
              fontSize: 11, fontWeight: 600,
              border: "1px solid rgba(255,59,48,0.3)", cursor: "pointer",
              opacity: sending ? 0.5 : 1,
            }}
          >
            Deny
          </button>
        </div>
      )}

      {/* Review input */}
      {status.state === "waiting_review" && (
        <div
          style={{ display: "flex", gap: 6, marginTop: "auto" }}
        >
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
            placeholder="Type a response..."
            style={{
              flex: 1, height: 26, borderRadius: 13,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff", fontSize: 12,
              padding: "0 12px", outline: "none",
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !inputText.trim()}
            style={{
              height: 26, paddingInline: 14, borderRadius: 13,
              background: "#0a84ff", color: "#fff",
              fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              opacity: (sending || !inputText.trim()) ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      )}

      {/* Agent completed response panel */}
      {status.state === "idle" && lastAgentMessage && (
        <AgentResponsePanel message={lastAgentMessage} onClear={onClearAgentMessage} onToggle={onResponsePanelToggle} />
      )}
    </div>
  );
}