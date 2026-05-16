import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useAgendaWeek,
  useAgendaFocusSuggestion,
} from "../../hooks/modules/useAgenda.js";

function timeOnly(iso: string, tz = "America/Sao_Paulo"): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch {
    return iso;
  }
}

export function AgendaPage(): JSX.Element {
  const { data: week, isLoading, error, refetch } = useAgendaWeek();
  const [showFocus, setShowFocus] = useState(false);
  const { data: focus, isLoading: focusLoading } = useAgendaFocusSuggestion(showFocus);

  return (
    <ModuleShell icon="⬡" label="AGENDA" sub="Eventos · Conflitos · Focus" color="#10B981">
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            onClick={() => refetch()}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              color: "#10B981",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ↻ ATUALIZAR
          </button>
          <button
            onClick={() => setShowFocus((p) => !p)}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: showFocus ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${showFocus ? "#F59E0B55" : "rgba(255,255,255,0.1)"}`,
              color: showFocus ? "#F59E0B" : "rgba(255,255,255,0.5)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ◐ {showFocus ? "ESCONDER" : "SUGERIR BLOCO DE FOCO"}
          </button>
        </div>

        {showFocus && (
          <div
            style={{
              padding: 18,
              marginBottom: 24,
              background: "linear-gradient(135deg, rgba(245,158,11,0.1), transparent)",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: 10,
              whiteSpace: "pre-wrap",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.7,
            }}
          >
            {focusLoading ? "◌ calculando bloco ideal…" : focus?.suggestion ?? "—"}
          </div>
        )}

        {isLoading && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
            ◌ carregando agenda da semana…
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
            ✗ Falha: {(error as Error).message}. Conecte o Google Calendar em /integrations.
          </div>
        )}

        {week && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            {week.map((day) => (
              <div
                key={day.date}
                style={{
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  minHeight: 200,
                }}
              >
                <div
                  className="hud-label"
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 4,
                  }}
                >
                  {day.weekday.slice(0, 3).toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontFamily: "'Share Tech Mono', monospace",
                    color: "#10B981",
                    marginBottom: 10,
                    textShadow: "0 0 8px rgba(16,185,129,0.5)",
                  }}
                >
                  {day.date.slice(8, 10)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {day.events.length === 0 && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,0.15)",
                        fontFamily: "'Share Tech Mono', monospace",
                      }}
                    >
                      —
                    </div>
                  )}
                  {day.events.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        padding: "5px 7px",
                        background: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.25)",
                        borderRadius: 4,
                        fontSize: 10,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          color: "#10B981",
                          fontSize: 9,
                        }}
                      >
                        {timeOnly(e.start)}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 600, lineHeight: 1.3 }}>
                        {e.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
