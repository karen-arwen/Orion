import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Send, MessageSquare, Minimize2 } from "lucide-react";
import type { ChatMessage } from "@orion/types";
import { api, streamChat } from "../../lib/api.js";
import { ChatMsg } from "./ChatMsg.js";

/* ═══════════════════════════════════════════════════════════════════
   ModuleChat — Chat contextualizado para qualquer módulo.

   Flutuante no canto inferior direito, abre/fecha com um botão.
   Envia mensagens com `module` preenchido para que a IA receba
   o system prompt e contexto do módulo automaticamente.
═══════════════════════════════════════════════════════════════════ */

interface ModuleChatProps {
  /** Identificador do módulo (ex: "finance", "health", "agenda") */
  module: string;
  /** Label exibido no header do chat */
  label: string;
  /** Cor primária do módulo */
  color: string;
  /** Sugestões rápidas específicas do módulo */
  suggestions?: string[];
  /** Mensagem de boas-vindas */
  welcome?: string;
}

export function ModuleChat({
  module,
  label,
  color,
  suggestions = [],
  welcome,
}: ModuleChatProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    welcome
      ? [{ id: "welcome", role: "assistant" as const, content: welcome }]
      : [],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return window.localStorage.getItem(`orion-chat-${module}`) ?? null; } catch { return null; }
  });
  const endRef = useRef<HTMLDivElement>(null);

  // Persist conversationId per module
  useEffect(() => {
    if (conversationId) {
      try { window.localStorage.setItem(`orion-chat-${module}`, conversationId); } catch { /* noop */ }
    }
  }, [conversationId, module]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;

      const userMsg: ChatMessage = { role: "user", content: msg };
      const placeholderId = `pending-${Date.now()}`;
      const placeholder: ChatMessage = {
        id: placeholderId,
        role: "assistant",
        content: "",
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, placeholder]);
      setInput("");
      setLoading(true);

      let streamed = "";
      let needsFallback = false;

      try {
        await streamChat(
          { message: msg, conversationId: conversationId ?? undefined, module },
          {
            onMeta: (cid) => setConversationId(cid),
            onText: (chunk) => {
              streamed += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId ? { ...m, content: streamed, loading: true } : m,
                ),
              );
            },
            onFallback: () => {
              needsFallback = true;
            },
            onError: () => {
              needsFallback = true;
            },
          },
        );
      } catch {
        needsFallback = true;
      }

      if (needsFallback || !streamed) {
        try {
          const res = await api.sendMessage({
            message: msg,
            conversationId: conversationId ?? undefined,
            module,
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? { ...res.message, id: `a-${Date.now()}` }
                : m,
            ),
          );
          setConversationId(res.conversationId);
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? { ...m, content: "◌ Falha ao comunicar com o núcleo.", loading: false }
                : m,
            ),
          );
        }
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, id: `a-${Date.now()}`, content: streamed, loading: false }
              : m,
          ),
        );
      }

      setLoading(false);
    },
    [input, loading, conversationId, module],
  );

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // ── Botão flutuante ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={`Assistente ${label}`}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${color}25, rgba(124,58,237,0.12))`,
          border: `1px solid ${color}55`,
          color,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 20px ${color}20, 0 4px 12px rgba(0,0,0,0.4)`,
          zIndex: 1000,
          transition: "all 0.2s ease",
        }}
      >
        <MessageSquare size={22} />
      </button>
    );
  }

  // ── Painel de chat ──
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 380,
        height: 520,
        borderRadius: 16,
        background: "linear-gradient(180deg, #080c14 0%, #050810 100%)",
        border: `1px solid ${color}30`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: `0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.6)`,
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${color}20`,
          background: `${color}08`,
          flexShrink: 0,
        }}
      >
        <MessageSquare size={16} color={color} />
        <div style={{ flex: 1 }}>
          <div
            className="hud-label"
            style={{ fontSize: 10, color, letterSpacing: "0.12em" }}
          >
            ASSISTENTE {label}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>
            Pergunte qualquer coisa sobre {label.toLowerCase()}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Minimize2 size={13} />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px",
        }}
      >
        {messages.map((m, i) => (
          <ChatMsg
            key={m.id ?? `msg-${i}`}
            msg={m}
            color={color}
            onAction={(text) => void send(text)}
          />
        ))}

        {loading && messages[messages.length - 1]?.content === "" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <div style={{ display: "flex", gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: color,
                    opacity: 0.5,
                    animation: `orionPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: 9,
                fontFamily: "'Share Tech Mono', monospace",
                color: `${color}66`,
                letterSpacing: "0.08em",
              }}
            >
              ANALISANDO
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && suggestions.length > 0 && (
        <div style={{ padding: "0 16px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              style={{
                padding: "4px 10px",
                fontSize: 9,
                fontFamily: "'Share Tech Mono', monospace",
                background: `${color}08`,
                border: `1px solid ${color}25`,
                color: `${color}99`,
                borderRadius: 20,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "10px 16px 14px",
          borderTop: `1px solid ${color}15`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${color}20`,
            borderRadius: 10,
            padding: "8px 10px",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Pergunte ao assistente ${label.toLowerCase()}...`}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.8)",
              fontSize: 12,
              resize: "none",
              fontFamily: "'Rajdhani', sans-serif",
              lineHeight: 1.5,
              maxHeight: 70,
              overflowY: "auto",
              outline: "none",
            }}
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              flexShrink: 0,
              background: loading
                ? "rgba(255,255,255,0.03)"
                : `linear-gradient(135deg, ${color}20, rgba(124,58,237,0.09))`,
              border: `1px solid ${loading ? "rgba(255,255,255,0.07)" : `${color}45`}`,
              color: loading ? "rgba(255,255,255,0.15)" : color,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
