import { useState } from "react";
import { motion } from "framer-motion";
import type { ChatMessage } from "@orion/types";
import { api } from "../../lib/api.js";
import { getActionCards } from "../../lib/actionCards.js";
import { ActionCard } from "./ActionCard.js";
import { MarkdownRenderer } from "../visual/MarkdownRenderer.js";

interface ChatMsgProps {
  msg: ChatMessage;
  color: string;
  onAction: (command: string) => void;
  onSaveTask?: (content: string) => void;
}

export function ChatMsg({ msg, color, onAction, onSaveTask }: ChatMsgProps): JSX.Element {
  const isUser = msg.role === "user";
  const [reactions, setReactions] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState(false);
  const actionCards = getActionCards(msg);

  const toggleReaction = (emoji: string): void => {
    setReactions((prev) => {
      const next = new Set(prev);
      if (next.has(emoji)) next.delete(emoji);
      else next.add(emoji);
      return next;
    });
    const isPositive = emoji === "\u{1F44D}" || emoji === "\u{2B50}";
    void api.sendChatFeedback({ message: msg.content, helpful: isPositive }).catch(() => {/* noop */});
  };

  const hasActiveReactions = reactions.size > 0;
  const showReactions = !isUser && !msg.loading && msg.content && (hovered || hasActiveReactions);
  const showSaveTask = !isUser && !msg.loading && msg.content && hovered && onSaveTask;
  const hasDecisionReference = /decision inbox|aguardando aprova|pendente.*inbox/i.test(msg.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, x: isUser ? 12 : -12 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 14,
        gap: 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
          {"O"}
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
          wordBreak: "break-word" as const,
          fontSize: isUser ? 13 : 12,
        }}
      >
        {isUser ? (
          <span style={{ fontFamily: "'Rajdhani', sans-serif", whiteSpace: "pre-wrap" }}>
            {msg.content}
          </span>
        ) : (
          <div style={{ fontFamily: "'Share Tech Mono', monospace" }}>
            <MarkdownRenderer content={msg.content} color={color} />
          </div>
        )}

        {msg.loading && <span style={{ animation: "blink 0.8s infinite", color }}>{">"}</span>}

        {showSaveTask && (
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => onSaveTask!(msg.content)}
              style={{ padding: "5px 10px", fontSize: 9, fontFamily: "'Share Tech Mono', monospace", background: `${color}10`, border: `1px solid ${color}30`, color, borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span>*</span> SALVAR COMO TAREFA
            </button>
          </div>
        )}

        {showReactions && (
          <div style={{
            display: "flex",
            gap: 4,
            marginTop: 8,
            opacity: hovered ? 1 : 0.7,
            transition: "opacity 0.2s ease",
          }}>
            {(["\u{1F44D}", "\u{1F44E}", "\u{2B50}", "\u{1F4CC}"] as const).map((emoji) => {
              const active = reactions.has(emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  title={emoji}
                  aria-label={`Reagir com ${emoji}`}
                  style={{
                    width: 26,
                    height: 24,
                    borderRadius: 6,
                    background: active ? `${color}18` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? color + "44" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: active ? 1 : 0.5,
                    transition: "all 0.15s ease",
                    transform: active ? "scale(1.12)" : "scale(1)",
                  }}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}

        {actionCards.length > 0 && (
          <div className="orion-action-card-row">
            {actionCards.map((c) => (
              <ActionCard key={c.id} card={c} color={color} onRun={onAction} />
            ))}
          </div>
        )}

        {!isUser && !msg.loading && hasDecisionReference && (
          <div style={{
            display: "flex",
            gap: 6,
            marginTop: 10,
            padding: "8px 0 2px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}>
            <button
              onClick={() => onAction("Aprove a ultima decisao pendente na Decision Inbox.")}
              style={{
                flex: 1,
                padding: "7px 12px",
                fontSize: 10,
                fontFamily: "'Share Tech Mono', monospace",
                background: "#10B98115",
                border: "1px solid #10B98133",
                color: "#10B981",
                borderRadius: 6,
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              APROVAR
            </button>
            <button
              onClick={() => onAction("Rejeite a ultima decisao pendente na Decision Inbox.")}
              style={{
                flex: 1,
                padding: "7px 12px",
                fontSize: 10,
                fontFamily: "'Share Tech Mono', monospace",
                background: "#EF444415",
                border: "1px solid #EF444433",
                color: "#EF4444",
                borderRadius: 6,
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              REJEITAR
            </button>
            <button
              onClick={() => onAction("Me mostre os detalhes da ultima decisao pendente.")}
              style={{
                padding: "7px 12px",
                fontSize: 10,
                fontFamily: "'Share Tech Mono', monospace",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.4)",
                borderRadius: 6,
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              DETALHES
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
