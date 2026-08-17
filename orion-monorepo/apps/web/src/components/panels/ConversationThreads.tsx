import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

/* ═══════════════════════════════════════════════════════════════════
   CONVERSATION THREADS — histórico de conversas organizado.

   Lista conversas anteriores agrupadas por módulo/tempo.
   Permite continuar uma conversa antiga.
═══════════════════════════════════════════════════════════════════ */

interface Conversation {
  id: string;
  title: string | null;
  moduleId: string | null;
  updatedAt: string;
  messageCount: number;
}

interface ConversationThreadsProps {
  color: string;
  onSelectConversation: (id: string) => void;
  activeConversationId?: string;
}

const MODULE_LABELS: Record<string, string> = {
  comms: "COMMS", life: "LIFE OS", finance: "CFO", habits: "HABITOS",
  sleep: "SONO", focus: "FOCO", media: "MIDIA", dev: "DEV",
  social: "SOCIAL", career: "CARREIRA", health: "SAUDE", chef: "CHEF",
  travel: "VIAGEM", mindset: "MINDSET", security: "SEGURANCA",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ConversationThreads({ color, onSelectConversation, activeConversationId }: ConversationThreadsProps): JSX.Element {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    void api.listConversations()
      .then((data) => {
        if (alive) {
          setConversations(
            (data as Conversation[]).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
          );
          setLoading(false);
        }
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = filter === "all"
    ? conversations
    : conversations.filter((c) => c.moduleId === filter);

  const modules = [...new Set(conversations.map((c) => c.moduleId).filter(Boolean))] as string[];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRight: `1px solid ${color}10`,
      background: "rgba(0,0,0,0.15)",
      width: 240,
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${color}10`,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 10,
        color,
        letterSpacing: "0.08em",
      }}>
        CONVERSAS
      </div>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: 4,
        padding: "8px 10px",
        overflowX: "auto",
        scrollbarWidth: "none",
        flexShrink: 0,
      }}>
        <FilterChip label="TODAS" active={filter === "all"} color={color} onClick={() => setFilter("all")} />
        {modules.map((m) => (
          <FilterChip
            key={m}
            label={MODULE_LABELS[m] ?? m.toUpperCase()}
            active={filter === m}
            color={color}
            onClick={() => setFilter(m)}
          />
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading ? (
          <div style={{ padding: 14, color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 14, color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Nenhuma conversa.</div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  background: isActive ? `${color}12` : "transparent",
                  border: "none",
                  borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  fontSize: 12,
                  color: isActive ? color : "rgba(255,255,255,0.6)",
                  fontWeight: isActive ? 600 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 3,
                }}>
                  {conv.title ?? "Conversa sem titulo"}
                </div>
                <div style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 9,
                  fontFamily: "'Share Tech Mono', monospace",
                  color: "rgba(255,255,255,0.2)",
                }}>
                  <span>{timeAgo(conv.updatedAt)}</span>
                  {conv.moduleId && <span>{MODULE_LABELS[conv.moduleId] ?? conv.moduleId}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* New conversation button */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${color}10` }}>
        <button
          onClick={() => onSelectConversation("")}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 6,
            border: `1px solid ${color}30`,
            background: `${color}08`,
            color,
            fontSize: 10,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: "pointer",
          }}
        >
          + NOVA CONVERSA
        </button>
      </div>
    </div>
  );
}

function FilterChip({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 8px",
        borderRadius: 10,
        border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
        background: active ? `${color}15` : "transparent",
        color: active ? color : "rgba(255,255,255,0.3)",
        fontSize: 8,
        fontFamily: "'Share Tech Mono', monospace",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
