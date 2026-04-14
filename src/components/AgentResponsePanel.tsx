import { useState } from "react";

interface Props {
  message: string;
  onClear?: () => void;
  onToggle?: (expanded: boolean) => void;
}

const MAX_CONTENT_HEIGHT = 200;

export default function AgentResponsePanel({ message, onClear, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onToggle?.(next);
  };

  return (
    <div style={{
      marginTop: 4,
      borderRadius: 8,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden",
    }}>
      {/* Header — click to toggle */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Chevron */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              flexShrink: 0,
            }}
          >
            <polyline points="4,2 8,6 4,10" />
          </svg>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 500 }}>
            Agent Response
          </span>
        </div>

        {/* Clear button */}
        {onClear && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              cursor: "pointer",
              padding: "0 4px",
            }}
          >
            Clear
          </div>
        )}
      </div>

      {/* Expandable content area with scrollbar */}
      {expanded && (
        <div
          className="agent-response-content"
          style={{
            maxHeight: MAX_CONTENT_HEIGHT,
            overflowY: "auto",
            padding: "0 10px 8px",
            color: "rgba(255,255,255,0.55)",
            fontSize: 11,
            lineHeight: "16px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
