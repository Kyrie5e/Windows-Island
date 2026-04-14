import { useState } from "react";
import { api, MediaInfo } from "../../lib/tauri";

interface Props {
  media: MediaInfo | null;
}

function MusicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export default function MediaTab({ media }: Props) {
  const [showLyrics, setShowLyrics] = useState(false);

  if (!media || !media.has_session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "rgba(255,255,255,0.3)" }}>
        <MusicIcon />
        <span style={{ fontSize: 13 }}>No media playing</span>
      </div>
    );
  }

  const title = media.title || "Unknown";
  const artist = media.artist || "Unknown artist";

  function handlePrev() { api.mediaControl("prev").catch(() => {}); }
  function handlePlayPause() {
    api.mediaControl(media!.playing ? "pause" : "play").catch(() => {});
  }
  function handleNext() { api.mediaControl("next").catch(() => {}); }

  return (
    <div style={{ display: "flex", alignItems: "center", height: "100%", padding: "0 12px", gap: 14 }}>
      {/* Album art placeholder */}
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: "rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <MusicIcon />
      </div>

      {/* Song info + controls */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="marquee-container" style={{ maxWidth: 200 }}>
            <span
              className={title.length > 20 ? "marquee-text" : ""}
              style={{ color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {title}
            </span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
            {artist}
          </div>
        </div>

        {/* Playback controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handlePrev} style={{ padding: 4, opacity: 0.6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={handlePlayPause} style={{ padding: 6, background: "rgba(255,255,255,0.1)", borderRadius: "50%" }}>
            {media.playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          <button onClick={handleNext} style={{ padding: 4, opacity: 0.6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Lyrics toggle */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            fontSize: 11,
            color: showLyrics ? "#0a84ff" : "rgba(255,255,255,0.4)",
            background: showLyrics ? "rgba(10,132,255,0.15)" : "rgba(255,255,255,0.06)",
            transition: "all 0.2s",
          }}
        >
          lyrics
        </button>
        {showLyrics && (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, textAlign: "center" }}>
            Not supported yet
          </div>
        )}
      </div>
    </div>
  );
}
