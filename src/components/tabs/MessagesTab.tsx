import { NotificationInfo } from "../../lib/tauri";

interface Props {
  notification: NotificationInfo | null;
}

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function MessagesTab({ notification }: Props) {
  if (!notification) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "rgba(255,255,255,0.3)" }}>
        <MessageIcon />
        <span style={{ fontSize: 13 }}>No new messages</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", height: "100%", padding: "0 16px", gap: 12 }}>
      {/* App icon area */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: "rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <MessageIcon />
      </div>

      {/* Message content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 500 }}>
            {notification.app}
          </span>
        </div>
        <div style={{
          color: "#fff", fontSize: 13, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {notification.title}
        </div>
        <div style={{
          color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {notification.body}
        </div>
      </div>
    </div>
  );
}
