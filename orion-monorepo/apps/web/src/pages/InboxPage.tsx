import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useInboxItems,
  useInboxStats,
  useMarkRead,
  useMarkActed,
  useArchiveItem,
  useMarkAllRead,
  useSyncInbox,
} from "../hooks/modules/useInbox.js";
import { ModuleSkeleton } from "../components/visual/HudSkeleton.js";

// ── Source icons & colors ───────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  gmail: { icon: "✉", color: "#00D4FF", label: "Gmail" },
  slack: { icon: "◆", color: "#E01E5A", label: "Slack" },
  github: { icon: "⬡", color: "#8B5CF6", label: "GitHub" },
  calendar: { icon: "◫", color: "#10B981", label: "Calendar" },
  system: { icon: "◈", color: "#F59E0B", label: "ORION" },
  discord: { icon: "◉", color: "#5865F2", label: "Discord" },
  whatsapp: { icon: "◎", color: "#25D366", label: "WhatsApp" },
  webhook: { icon: "⟡", color: "#6366F1", label: "Webhook" },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "#FF4444",
  urgent: "#F59E0B",
  normal: "#00D4FF",
  low: "rgba(255,255,255,0.3)",
};

type FilterTab = "all" | "unread" | "actionable" | "critical";

export function InboxPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const filters: Record<string, string | number | undefined> = {
    ...(activeTab === "unread" && { status: "unread" }),
    ...(activeTab === "actionable" && { status: "unread" }),
    ...(activeTab === "critical" && { urgency: "critical" }),
    ...(sourceFilter && { source: sourceFilter }),
    ...(search && { search }),
    limit: 50,
  };

  const { data: itemsData, isLoading } = useInboxItems(filters);
  const { data: stats } = useInboxStats();
  const markRead = useMarkRead();
  const markActed = useMarkActed();
  const archiveItem = useArchiveItem();
  const markAllRead = useMarkAllRead();
  const syncInbox = useSyncInbox();

  const items = itemsData?.items ?? [];

  const handleItemClick = useCallback(
    (item: Record<string, unknown>) => {
      if (item.status === "unread") {
        markRead.mutate(item.id as string);
      }
    },
    [markRead],
  );

  if (isLoading) return <ModuleSkeleton />;

  const tabs: Array<{ id: FilterTab; label: string; count?: number }> = [
    { id: "all", label: "TUDO", count: stats?.total },
    { id: "unread", label: "NÃO LIDOS", count: stats?.unread },
    { id: "actionable", label: "AÇÃO PENDENTE", count: stats?.actionable },
    { id: "critical", label: "URGENTE", count: stats?.critical },
  ];

  const sources = stats?.bySource ? Object.entries(stats.bySource) : [];

  return (
    <div style={{ padding: "0 4px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{
              fontSize: 20,
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              color: "#00D4FF",
              margin: 0,
              letterSpacing: "0.05em",
            }}
          >
            ◈ UNIVERSAL INBOX
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0", fontFamily: "'Share Tech Mono', monospace" }}>
            Feed unificado — tudo que precisa da sua atenção
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => syncInbox.mutate()}
            disabled={syncInbox.isPending}
            style={{
              padding: "6px 14px",
              background: "rgba(0, 212, 255, 0.1)",
              border: "1px solid rgba(0, 212, 255, 0.25)",
              borderRadius: 8,
              color: "#00D4FF",
              fontSize: 11,
              fontFamily: "'Share Tech Mono', monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
              opacity: syncInbox.isPending ? 0.5 : 1,
            }}
          >
            {syncInbox.isPending ? "◌ SYNCING…" : "⟲ SYNC"}
          </button>
          <button
            onClick={() => markAllRead.mutate(sourceFilter)}
            style={{
              padding: "6px 14px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              fontFamily: "'Share Tech Mono', monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            ✓ LER TUDO
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}>
          {[
            { label: "TOTAL", value: stats.total, color: "#00D4FF" },
            { label: "NÃO LIDOS", value: stats.unread, color: "#F59E0B" },
            { label: "URGENTE", value: stats.critical, color: "#FF4444" },
            { label: "AÇÃO", value: stats.actionable, color: "#10B981" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "12px 14px",
                background: "rgba(0, 212, 255, 0.03)",
                border: "1px solid rgba(0, 212, 255, 0.08)",
                borderRadius: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", fontFamily: "'Share Tech Mono', monospace" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: s.color, fontFamily: "'Rajdhani', sans-serif", marginTop: 2 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "6px 14px",
              background: activeTab === tab.id ? "rgba(0, 212, 255, 0.15)" : "transparent",
              border: `1px solid ${activeTab === tab.id ? "rgba(0, 212, 255, 0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              color: activeTab === tab.id ? "#00D4FF" : "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontFamily: "'Share Tech Mono', monospace",
              cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ marginLeft: 6, opacity: 0.6 }}>{tab.count}</span>
            )}
          </button>
        ))}

        {/* Source pills */}
        {sources.length > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)", margin: "0 6px", alignSelf: "center" }} />
            {sources.map(([src, count]) => {
              const cfg = SOURCE_CONFIG[src] ?? { icon: "•", color: "#888", label: src };
              const active = sourceFilter === src;
              return (
                <button
                  key={src}
                  onClick={() => setSourceFilter(active ? undefined : src)}
                  style={{
                    padding: "4px 10px",
                    background: active ? `${cfg.color}20` : "transparent",
                    border: `1px solid ${active ? cfg.color + "60" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 20,
                    color: active ? cfg.color : "rgba(255,255,255,0.35)",
                    fontSize: 10,
                    fontFamily: "'Share Tech Mono', monospace",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <span style={{ opacity: 0.5 }}>{count}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar no inbox..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "rgba(0, 212, 255, 0.03)",
            border: "1px solid rgba(0, 212, 255, 0.1)",
            borderRadius: 10,
            color: "#fff",
            fontSize: 13,
            fontFamily: "'Share Tech Mono', monospace",
            outline: "none",
          }}
        />
      </div>

      {/* Items */}
      <AnimatePresence mode="popLayout">
        {items.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "rgba(255,255,255,0.25)",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◈</div>
            Inbox limpo — nada pendente
          </motion.div>
        )}

        {items.map((item, idx) => {
          const src = SOURCE_CONFIG[item.source as string] ?? { icon: "•", color: "#888", label: item.source as string };
          const urgColor = URGENCY_COLORS[(item.urgency as string) ?? "normal"];
          const isUnread = item.status === "unread";

          return (
            <motion.div
              key={item.id as string}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => handleItemClick(item)}
              style={{
                padding: "14px 16px",
                marginBottom: 6,
                background: isUnread ? "rgba(0, 212, 255, 0.04)" : "transparent",
                border: `1px solid ${isUnread ? "rgba(0, 212, 255, 0.12)" : "rgba(255,255,255,0.04)"}`,
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {/* Urgency dot */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: urgColor,
                boxShadow: item.urgency === "critical" ? `0 0 8px ${urgColor}80` : "none",
                marginTop: 6,
                flexShrink: 0,
              }} />

              {/* Source icon */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${src.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: src.color,
                flexShrink: 0,
              }}>
                {src.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: isUnread ? 600 : 400,
                    color: isUnread ? "#fff" : "rgba(255,255,255,0.7)",
                    fontFamily: "'Rajdhani', sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.title as string}
                  </span>
                  {Boolean(item.actionable) && (
                    <span style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#10B981",
                      borderRadius: 4,
                      letterSpacing: "0.1em",
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      AÇÃO
                    </span>
                  )}
                </div>

                {Boolean(item.preview) && (
                  <div style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.35)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}>
                    {item.preview as string}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  {Boolean(item.sender) && (
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                      {item.sender as string}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>
                    {formatTime(item.createdAt as string)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {Boolean(item.actionable) && item.status !== "acted" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markActed.mutate(item.id as string); }}
                    title="Marcar como feito"
                    style={actionBtnStyle}
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); archiveItem.mutate(item.id as string); }}
                  title="Arquivar"
                  style={actionBtnStyle}
                >
                  ↓
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.3)",
  fontSize: 12,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
