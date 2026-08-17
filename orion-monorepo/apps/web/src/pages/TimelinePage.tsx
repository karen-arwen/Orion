import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTimeline, useTimelineStats, useCreateTimelineEvent, useDeleteTimelineEvent } from "../hooks/modules/useTimeline.js";
import { ModuleSkeleton } from "../components/visual/HudSkeleton.js";

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  milestone: { icon: "◆", color: "#F59E0B", label: "Marco" },
  decision: { icon: "⬡", color: "#8B5CF6", label: "Decisão" },
  achievement: { icon: "★", color: "#10B981", label: "Conquista" },
  event: { icon: "◫", color: "#00D4FF", label: "Evento" },
  memory: { icon: "◉", color: "#EC4899", label: "Memória" },
  health: { icon: "♥", color: "#EF4444", label: "Saúde" },
  career: { icon: "▲", color: "#6366F1", label: "Carreira" },
  finance: { icon: "◇", color: "#14B8A6", label: "Finanças" },
  social: { icon: "◎", color: "#F97316", label: "Social" },
  travel: { icon: "✈", color: "#0EA5E9", label: "Viagem" },
  learning: { icon: "◈", color: "#A855F7", label: "Aprendizado" },
};

export function TimelinePage(): JSX.Element {
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({ type: "event", title: "", detail: "", date: new Date().toISOString().slice(0, 10) });

  const { data, isLoading } = useTimeline({ type: typeFilter, limit: 100 });
  const { data: stats } = useTimelineStats();
  const createEvent = useCreateTimelineEvent();
  const deleteEvent = useDeleteTimelineEvent();

  const items = data?.items ?? [];

  // Group by month
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const item of items) {
    const d = new Date(item.date as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const handleCreate = () => {
    if (!newEvent.title.trim()) return;
    createEvent.mutate({
      type: newEvent.type,
      title: newEvent.title,
      detail: newEvent.detail || undefined,
      date: new Date(newEvent.date).toISOString(),
    });
    setNewEvent({ type: "event", title: "", detail: "", date: new Date().toISOString().slice(0, 10) });
    setShowAdd(false);
  };

  if (isLoading) return <ModuleSkeleton />;

  const typeStats = (stats as Record<string, unknown>)?.byType as Record<string, number> | undefined;

  return (
    <div style={{ padding: "0 4px", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#00D4FF", margin: 0, letterSpacing: "0.05em" }}>
            ◈ LIFE TIMELINE
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0", fontFamily: "'Share Tech Mono', monospace" }}>
            {data?.total ?? 0} momentos registrados
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: "8px 16px",
            background: showAdd ? "rgba(255,68,68,0.15)" : "rgba(0, 212, 255, 0.15)",
            border: `1px solid ${showAdd ? "rgba(255,68,68,0.3)" : "rgba(0, 212, 255, 0.3)"}`,
            borderRadius: 8,
            color: showAdd ? "#FF6B6B" : "#00D4FF",
            fontSize: 12,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          {showAdd ? "✕ CANCELAR" : "+ REGISTRAR MOMENTO"}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              overflow: "hidden",
              marginBottom: 20,
              border: "1px solid rgba(0, 212, 255, 0.15)",
              borderRadius: 12,
              padding: 20,
              background: "rgba(0, 212, 255, 0.03)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <select
                value={newEvent.type}
                onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                style={inputStyle}
              >
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                style={inputStyle}
              />
            </div>
            <input
              placeholder="O que aconteceu?"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              style={{ ...inputStyle, marginBottom: 12 }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <textarea
              placeholder="Detalhes (opcional)"
              value={newEvent.detail}
              onChange={(e) => setNewEvent({ ...newEvent, detail: e.target.value })}
              rows={2}
              style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }}
            />
            <button onClick={handleCreate} disabled={!newEvent.title.trim()} style={{
              padding: "8px 20px",
              background: "rgba(0, 212, 255, 0.2)",
              border: "1px solid rgba(0, 212, 255, 0.4)",
              borderRadius: 8,
              color: "#00D4FF",
              fontSize: 12,
              fontFamily: "'Share Tech Mono', monospace",
              cursor: newEvent.title.trim() ? "pointer" : "not-allowed",
              opacity: newEvent.title.trim() ? 1 : 0.4,
            }}>
              ✓ SALVAR
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Type filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => setTypeFilter(undefined)}
          style={pillStyle(!typeFilter)}
        >
          TUDO
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const count = typeStats?.[key] ?? 0;
          if (count === 0 && typeFilter !== key) return null;
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? undefined : key)}
              style={{
                ...pillStyle(typeFilter === key),
                color: typeFilter === key ? cfg.color : "rgba(255,255,255,0.35)",
                borderColor: typeFilter === key ? cfg.color + "60" : "rgba(255,255,255,0.06)",
                background: typeFilter === key ? cfg.color + "15" : "transparent",
              }}
            >
              {cfg.icon} {cfg.label} <span style={{ opacity: 0.5 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>◈</div>
          Sua timeline está vazia — registre seu primeiro momento
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 32 }}>
          {/* Vertical line */}
          <div style={{
            position: "absolute",
            left: 11,
            top: 0,
            bottom: 0,
            width: 1,
            background: "linear-gradient(180deg, rgba(0,212,255,0.3) 0%, rgba(0,212,255,0.05) 100%)",
          }} />

          {Array.from(grouped.entries()).map(([monthKey, monthItems]) => {
            const [y, m] = monthKey.split("-");
            const monthLabel = new Date(Number(y), Number(m) - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

            return (
              <div key={monthKey} style={{ marginBottom: 28 }}>
                {/* Month label */}
                <div style={{
                  position: "relative",
                  marginBottom: 14,
                  marginLeft: -32,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(0, 212, 255, 0.15)",
                    border: "1px solid rgba(0, 212, 255, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    color: "#00D4FF",
                  }}>
                    ◈
                  </div>
                  <span style={{
                    fontSize: 13,
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 600,
                    color: "#00D4FF",
                    textTransform: "capitalize",
                    letterSpacing: "0.05em",
                  }}>
                    {monthLabel}
                  </span>
                </div>

                {/* Events */}
                {monthItems.map((item, idx) => {
                  const cfg = TYPE_CONFIG[item.type as string] ?? { icon: "•", color: "#888", label: "Outro" };
                  const d = new Date(item.date as string);

                  return (
                    <motion.div
                      key={item.id as string}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      style={{
                        position: "relative",
                        marginBottom: 8,
                        marginLeft: -32,
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Dot */}
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: cfg.color + "20",
                        border: `1px solid ${cfg.color}40`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: cfg.color,
                        flexShrink: 0,
                        marginTop: 2,
                      }}>
                        {(item.icon as string) ?? cfg.icon}
                      </div>

                      {/* Content card */}
                      <div style={{
                        flex: 1,
                        padding: "10px 14px",
                        background: "rgba(0, 212, 255, 0.02)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 10,
                        borderLeft: `2px solid ${cfg.color}40`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontFamily: "'Rajdhani', sans-serif" }}>
                            {item.title as string}
                          </span>
                          <span style={{
                            fontSize: 9,
                            padding: "1px 6px",
                            background: cfg.color + "15",
                            color: cfg.color,
                            borderRadius: 4,
                            fontFamily: "'Share Tech Mono', monospace",
                          }}>
                            {cfg.label}
                          </span>
                        </div>
                        {Boolean(item.detail) && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4, lineHeight: 1.5 }}>
                            {item.detail as string}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>
                            {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            {Boolean(item.module) && ` · ${item.module}`}
                          </span>
                          <button
                            onClick={() => deleteEvent.mutate(item.id as string)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "rgba(255,255,255,0.15)",
                              fontSize: 10,
                              cursor: "pointer",
                              padding: "2px 6px",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(0, 0, 0, 0.3)",
  border: "1px solid rgba(0, 212, 255, 0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  fontFamily: "'Share Tech Mono', monospace",
  outline: "none",
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 12px",
    background: active ? "rgba(0, 212, 255, 0.12)" : "transparent",
    border: `1px solid ${active ? "rgba(0, 212, 255, 0.3)" : "rgba(255,255,255,0.06)"}`,
    borderRadius: 20,
    color: active ? "#00D4FF" : "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: "'Share Tech Mono', monospace",
    cursor: "pointer",
    letterSpacing: "0.03em",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };
}
