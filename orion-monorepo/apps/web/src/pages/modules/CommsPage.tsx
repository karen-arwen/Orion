import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useCommsInbox, useCommsSummary } from "../../hooks/modules/useComms.js";

const URGENCY_META = {
  urgent: { label: "URGENTE", color: "#EF4444" },
  relevant: { label: "RELEVANTE", color: "#00D4FF" },
  noise: { label: "RUÍDO", color: "rgba(255,255,255,0.25)" },
} as const;

export function CommsPage(): JSX.Element {
  const { data: inbox, isLoading, error, refetch } = useCommsInbox();
  const [showSummary, setShowSummary] = useState(false);
  const { data: summary, isLoading: summaryLoading } = useCommsSummary(showSummary);

  const urgent = inbox?.filter((m) => m.urgency === "urgent") ?? [];
  const relevant = inbox?.filter((m) => m.urgency === "relevant") ?? [];
  const noise = inbox?.filter((m) => m.urgency === "noise") ?? [];

  return (
    <ModuleShell icon="◈" label="COMMS" sub="Email · WhatsApp · Slack" color="#00D4FF">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            onClick={() => refetch()}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: "rgba(0,212,255,0.12)",
              border: "1px solid rgba(0,212,255,0.35)",
              color: "#00D4FF",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ↻ ATUALIZAR
          </button>
          <button
            onClick={() => setShowSummary((p) => !p)}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: showSummary ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${showSummary ? "#7C3AED55" : "rgba(255,255,255,0.1)"}`,
              color: showSummary ? "#7C3AED" : "rgba(255,255,255,0.5)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ✦ {showSummary ? "ESCONDER RESUMO" : "RESUMO INTELIGENTE"}
          </button>
        </div>

        {/* AI Summary */}
        {showSummary && (
          <div
            style={{
              padding: 18,
              marginBottom: 24,
              background: "linear-gradient(135deg, rgba(124,58,237,0.10), transparent)",
              border: "1px solid rgba(124,58,237,0.3)",
              borderRadius: 10,
              whiteSpace: "pre-wrap",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.7,
            }}
          >
            {summaryLoading ? "◌ gerando resumo executivo…" : summary?.summary ?? "—"}
          </div>
        )}

        {/* Loading / Error */}
        {isLoading && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
            ◌ carregando inbox classificada…
          </div>
        )}
        {error && (
          <div
            style={{
              padding: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              color: "#EF4444",
              fontSize: 12,
            }}
          >
            ✗ Falha: {(error as Error).message}. Verifique se o Gmail está conectado em /integrations.
          </div>
        )}

        {/* Stats */}
        {inbox && inbox.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
            <Stat label="URGENTES" value={urgent.length} color={URGENCY_META.urgent.color} />
            <Stat label="RELEVANTES" value={relevant.length} color={URGENCY_META.relevant.color} />
            <Stat label="RUÍDO" value={noise.length} color="rgba(255,255,255,0.4)" />
          </div>
        )}

        {/* Inbox */}
        {inbox && inbox.length > 0 && (
          <>
            <Section title="Urgentes" items={urgent} />
            <Section title="Relevantes" items={relevant} />
            <Section title="Ruído" items={noise} muted />
          </>
        )}

        {inbox && inbox.length === 0 && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.3)", padding: 40, textAlign: "center" }}>
            Caixa silenciosa nos últimos 3 dias.
          </div>
        )}
      </div>
    </ModuleShell>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        padding: 14,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${color}25`,
        borderRadius: 8,
      }}
    >
      <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontFamily: "'Share Tech Mono', monospace",
          color,
          fontWeight: 700,
          textShadow: `0 0 10px ${color}80`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

interface InboxItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  urgency: "urgent" | "relevant" | "noise";
  reason: string;
  unread: boolean;
}

function Section({
  title,
  items,
  muted = false,
}: {
  title: string;
  items: InboxItem[];
  muted?: boolean;
}): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
        {title} · {items.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: muted ? 0.55 : 1 }}>
        {items.map((m) => {
          const meta = URGENCY_META[m.urgency];
          return (
            <div
              key={m.id}
              style={{
                padding: "12px 14px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${meta.color}22`,
                borderRadius: 8,
                borderLeft: `3px solid ${meta.color}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span
                  className="hud-label"
                  style={{ fontSize: 8, color: meta.color, letterSpacing: "0.15em" }}
                >
                  {meta.label} {m.unread && "·  NÃO LIDO"}
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{m.date}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>
                {m.subject}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                {m.from}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>
                {m.snippet}
              </div>
              {m.reason && (
                <div
                  style={{
                    fontSize: 10,
                    color: meta.color,
                    fontFamily: "'Share Tech Mono', monospace",
                    fontStyle: "italic",
                  }}
                >
                  ◉ {m.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
