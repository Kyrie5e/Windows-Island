import { useState, useRef, useEffect } from "react";
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

const MIN_TEXTAREA_HEIGHT = 32;
const MAX_TEXTAREA_HEIGHT = 80;

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

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
}

export default function AITab({ status, onResponded, lastAgentMessage, onClearAgentMessage, onResponsePanelToggle }: Props) {
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAttention = status.state === "waiting_review" || status.state === "permission_required";

  useEffect(() => {
    if (textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [inputText, status.state]);

  const handleApprove = async () => {
    setError(null);
    setSending(true);
    try {
      await api.sendAgentResponse("approve");
      setSending(false);
      onResponded?.();
    } catch {
      setSending(false);
      setError("Failed to approve. Try again.");
    }
  };

  const handleAlwaysAllow = async () => {
    setError(null);
    setSending(true);
    try {
      await api.sendAgentResponse("always_allow");
      setSending(false);
      onResponded?.();
    } catch {
      setSending(false);
      setError("Failed to save permission. Try again.");
    }
  };

  const handleDeny = async () => {
    setError(null);
    setSending(true);
    try {
      await api.sendAgentResponse("deny");
      setSending(false);
      onResponded?.();
    } catch {
      setSending(false);
      setError("Failed to deny. Try again.");
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    setError(null);
    setSending(true);
    try {
      await api.sendAgentResponse("ask", inputText.trim());
      setInputText("");
      setSending(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
      }
      if (status.state === "idle") {
        onClearAgentMessage?.();
      } else {
        onResponded?.();
      }
    } catch {
      setSending(false);
      setError("Failed to send message. Try again.");
    }
  };

  const handleFocus = () => {
    api.focusAgentWindow().catch(() => {});
  };

  const textareaStyle: React.CSSProperties = {
    flex: 1,
    minHeight: MIN_TEXTAREA_HEIGHT,
    maxHeight: MAX_TEXTAREA_HEIGHT,
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: 12,
    padding: "6px 12px",
    outline: "none",
    resize: "none",
    lineHeight: "18px",
    fontFamily: "inherit",
    overflow: "auto",
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

      {/* Error message */}
      {error && (
        <div style={{ color: "#ff3b30", fontSize: 10, textAlign: "center" }}>
          {error}
        </div>
      )}

      {/* Review input */}
      {status.state === "waiting_review" && (
        <div
          style={{ display: "flex", gap: 6, marginTop: "auto", alignItems: "flex-end" }}
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a response..."
            rows={1}
            className="ai-textarea"
            style={textareaStyle}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !inputText.trim()}
            style={{
              height: 32, paddingInline: 14, borderRadius: 16,
              background: "#0a84ff", color: "#fff",
              fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              opacity: (sending || !inputText.trim()) ? 0.5 : 1,
              flexShrink: 0,
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

      {/* Idle input — send new messages to the agent */}
      {status.state === "idle" && (
        <div
          style={{ display: "flex", gap: 6, marginTop: "auto", alignItems: "flex-end" }}
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Send a message..."
            rows={1}
            className="ai-textarea"
            style={textareaStyle}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !inputText.trim()}
            style={{
              height: 32, paddingInline: 14, borderRadius: 16,
              background: "#0a84ff", color: "#fff",
              fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              opacity: (sending || !inputText.trim()) ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
