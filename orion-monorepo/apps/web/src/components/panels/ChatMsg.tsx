import type { ChatMessage } from "@orion/types";

interface ChatMsgProps {
  msg: ChatMessage;
  color: string;
}

export function ChatMsg({ msg, color }: ChatMsgProps): JSX.Element {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 14,
        gap: 10,
        animation: "fadeUp 0.25s ease",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: 2,
            background: `linear-gradient(135deg, ${color}20, #7C3AED20)`,
            border: `1px solid ${color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color,
          }}
        >
          ◉
        </div>
      )}
      <div
        style={{
          maxWidth: "76%",
          padding: "10px 14px",
          background: isUser
            ? "linear-gradient(135deg, rgba(124,58,237,0.13), rgba(0,212,255,0.07))"
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${isUser ? "rgba(124,58,237,0.21)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: isUser ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
          color: "rgba(255,255,255,0.8)",
          lineHeight: 1.7,
          fontFamily: isUser ? "'Rajdhani', sans-serif" : "'Share Tech Mono', monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: isUser ? 13 : 12,
        }}
      >
        {msg.content}
        {msg.loading && <span style={{ animation: "blink 0.8s infinite", color }}>▋</span>}
      </div>
    </div>
  );
}
