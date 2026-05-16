import { useEffect, useRef, type KeyboardEvent } from "react";
import type { ChatMessage, UserProfile } from "@orion/types";
import { ChatMsg } from "./ChatMsg.js";
import { QUICK_COMMANDS } from "../../lib/constants.js";

interface ChatPanelProps {
  profile: UserProfile;
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSend: (override?: string) => void;
}

export function ChatPanel({
  profile,
  messages,
  loading,
  input,
  onInputChange,
  onSend,
}: ChatPanelProps): JSX.Element {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const color = profile.theme.primary;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
        {messages.map((m, i) => (
          <ChatMsg key={m.id ?? `msg-${i}`} msg={m} color={color} />
        ))}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: "0 22px 10px", display: "flex", gap: 5, flexWrap: "wrap" }}>
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => onSend(cmd)}
            style={{
              padding: "4px 9px",
              fontSize: 9,
              fontFamily: "'Share Tech Mono', monospace",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.25)",
              borderRadius: 20,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      <div style={{ padding: "10px 22px 18px", borderTop: `1px solid ${color}10`, flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-end",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${color}20`,
            borderRadius: 11,
            padding: "9px 12px",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Comando para O.R.I.O.N..."
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.8)",
              fontSize: 13,
              resize: "none",
              fontFamily: "'Rajdhani', sans-serif",
              lineHeight: 1.5,
              maxHeight: 90,
              overflowY: "auto",
            }}
          />
          <button
            onClick={() => onSend()}
            disabled={loading || !input.trim()}
            style={{
              width: 34,
              height: 34,
              borderRadius: 7,
              flexShrink: 0,
              background: loading
                ? "rgba(255,255,255,0.03)"
                : `linear-gradient(135deg, ${color}20, rgba(124,58,237,0.09))`,
              border: `1px solid ${loading ? "rgba(255,255,255,0.07)" : color + "45"}`,
              color: loading ? "rgba(255,255,255,0.15)" : color,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              boxShadow: loading ? "none" : `0 0 8px ${color}18`,
            }}
          >
            {loading ? "◌" : "▶"}
          </button>
        </div>
        <div
          className="hud-label"
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.08)",
            marginTop: 5,
            textAlign: "center",
          }}
        >
          ENTER · enviar &nbsp;|&nbsp; SHIFT+ENTER · nova linha &nbsp;|&nbsp; MCPs ativos via núcleo
        </div>
      </div>
    </div>
  );
}
