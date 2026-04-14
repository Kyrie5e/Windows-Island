import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import powershell from "react-syntax-highlighter/dist/esm/languages/prism/powershell";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";

SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("rs", rust);
SyntaxHighlighter.registerLanguage("powershell", powershell);
SyntaxHighlighter.registerLanguage("ps1", powershell);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);

interface Props {
  message: string;
  onClear?: () => void;
  onToggle?: (expanded: boolean) => void;
}

const MAX_CONTENT_HEIGHT = 300;

export default function AgentResponsePanel({ message, onClear, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onToggle?.(next);
  };

  // Detect scroll position for shadow indicators
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !expanded) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTopShadow(scrollTop > 4);
      setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 4);
    };

    // Initial check
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [expanded, message]);

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
        <div style={{ position: "relative" }}>
          {/* Top scroll shadow */}
          {showTopShadow && (
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 16,
              background: "linear-gradient(to bottom, rgba(17,17,17,0.9), transparent)",
              zIndex: 1,
              pointerEvents: "none",
            }} />
          )}

          <div
            ref={contentRef}
            className="agent-response-content markdown-body"
            style={{
              maxHeight: MAX_CONTENT_HEIGHT,
              overflowY: "auto",
              padding: "0 10px 8px",
              color: "rgba(255,255,255,0.75)",
              fontSize: 12,
              lineHeight: "18px",
              wordBreak: "break-word",
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Code blocks with syntax highlighting
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");

                  if (match) {
                    return (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: "6px 0",
                          padding: "8px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          lineHeight: "16px",
                          background: "rgba(0,0,0,0.4)",
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  }

                  // Inline code
                  return (
                    <code
                      className={className}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        color: "#ff9f43",
                        padding: "1px 5px",
                        borderRadius: 3,
                        fontSize: 11,
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Don't wrap code blocks in <pre>
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {message}
            </ReactMarkdown>
          </div>

          {/* Bottom scroll shadow */}
          {showBottomShadow && (
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 16,
              background: "linear-gradient(to top, rgba(17,17,17,0.9), transparent)",
              zIndex: 1,
              pointerEvents: "none",
            }} />
          )}
        </div>
      )}
    </div>
  );
}
