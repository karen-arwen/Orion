import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useAgendaToday,
  useAgendaWeek,
  useAgendaFocusSuggestion,
} from "../../hooks/modules/useAgenda.js";

const PRIMARY = "#10B981";
const ACCENT = "#00D4FF";
const WARN = "#F59E0B";

function timeOnly(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch { return iso; }
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

export function AgendaPage(): JSX.Element {
  const { data: today } = useAgendaToday();
  const { data: week, isLoading, error, refetch } = useAgendaWeek();
  const [showFocus, setShowFocus] = useState(false);
  const { data: focus, isLoading: focusLoading } = useAgendaFocusSuggestion(showFocus);

  const todayEvents = today?.events ?? [];
  const conflicts = today?.conflicts ?? 0;
  const now = new Date();
  const currentHour = now.getHours();

  const nextEvent = todayEvents.find((e) => new Date(e.start) > now);
  const minutesUntilNext = nextEvent ? Math.round((new Date(nextEvent.start).getTime() - now.getTime()) / 60000) : null;

  return (
    <ModuleShell icon="⬡" label="AGENDA" sub="Eventos · Conflitos · Focus · Sugestoes" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Hero metrics ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
          <MetricCard label="HOJE" value={`${todayEvents.length} eventos`} color={PRIMARY} />
          <MetricCard label="CONFLITOS" value={conflicts > 0 ? `${conflicts} detectados` : "Nenhum"} color={conflicts > 0 ? "#EF4444" : PRIMARY} />
          <MetricCard label="PROXIMO" value={nextEvent ? `${nextEvent.summary.slice(0, 20)} em ${minutesUntilNext}min` : "Livre"} color={ACCENT} />
          <MetricCard label="FOCO" value={showFocus && focus ? "Sugestao ativa" : "Pedir sugestao"} color={WARN} onClick={() => setShowFocus(true)} />
        </div>

        {/* ── Focus suggestion ── */}
        {showFocus && (
          <section style={{
            padding: 18,
            marginBottom: 20,
            background: `linear-gradient(135deg, ${WARN}10, transparent)`,
            border: `1px solid ${WARN}35`,
            borderRadius: 10,
          }}>
            <div className="hud-label" style={{ color: WARN, fontSize: 10, marginBottom: 10, letterSpacing: "0.15em" }}>
              SUGESTAO DE BLOCO DE FOCO
            </div>
            <div style={{
              whiteSpace: "pre-wrap",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.7,
            }}>
              {focusLoading ? "Calculando melhor horario..." : focus?.suggestion ?? "—"}
            </div>
            {!focusLoading && focus?.suggestion && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: `1px solid ${WARN}15`, paddingTop: 12 }}>
                <button
                  onClick={() => {
                    // Copy suggestion to clipboard and notify
                    navigator.clipboard.writeText(focus.suggestion).catch(() => {});
                    alert("Sugestao copiada! Cole no chat principal para o ORION aplicar.");
                  }}
                  className="orion-command"
                  style={{ color: WARN, borderColor: `${WARN}55`, background: `${WARN}14`, fontSize: 10 }}
                >
                  COPIAR SUGESTAO
                </button>
                <button
                  onClick={() => setShowFocus(false)}
                  className="orion-command"
                  style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)", background: "transparent", fontSize: 10 }}
                >
                  FECHAR
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Today's timeline ── */}
        <section className="dash-section" style={{ marginBottom: 20 }}>
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14, letterSpacing: "0.15em" }}>
            TIMELINE DE HOJE · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {todayEvents.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
              Nenhum evento hoje. Dia livre para foco profundo.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayEvents.map((e) => {
                const eventTime = new Date(e.start);
                const isPast = eventTime < now;
                const isCurrent = isPast && new Date(e.end) > now;
                return (
                  <div key={e.id} style={{
                    display: "flex", gap: 12, padding: "10px 14px",
                    background: isCurrent ? `${PRIMARY}12` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isCurrent ? `${PRIMARY}40` : "rgba(255,255,255,0.05)"}`,
                    borderLeft: `3px solid ${isCurrent ? PRIMARY : isPast ? "rgba(255,255,255,0.1)" : ACCENT}`,
                    borderRadius: 8,
                    opacity: isPast && !isCurrent ? 0.5 : 1,
                  }}>
                    <div style={{ minWidth: 55, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: isCurrent ? PRIMARY : ACCENT }}>
                      {timeOnly(e.start)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                        {e.summary}
                      </div>
                      {e.location && (
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {e.location}
                        </div>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="hud-label" style={{ fontSize: 8, color: PRIMARY, alignSelf: "center" }}>AGORA</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Weekly grid ── */}
        {isLoading && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
            Carregando agenda da semana...
          </div>
        )}
        {error && (
          <div style={{
            padding: 16, background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8,
            color: "#EF4444", fontSize: 12,
          }}>
            Conecte o Google Calendar em Integracoes para ver sua agenda.
          </div>
        )}

        {week && (
          <section className="dash-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.15em" }}>
                VISAO SEMANAL
              </div>
              <button onClick={() => refetch()} className="orion-command" style={{ color: PRIMARY, borderColor: `${PRIMARY}55`, background: `${PRIMARY}14`, fontSize: 9, padding: "4px 10px" }}>
                ATUALIZAR
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {week.map((day) => {
                const dayIsToday = isToday(day.date);
                return (
                  <div key={day.date} style={{
                    padding: 10,
                    background: dayIsToday ? `${PRIMARY}08` : "rgba(255,255,255,0.015)",
                    border: `1px solid ${dayIsToday ? `${PRIMARY}40` : "rgba(255,255,255,0.04)"}`,
                    borderRadius: 8, minHeight: 140,
                  }}>
                    <div className="hud-label" style={{ fontSize: 8, color: dayIsToday ? PRIMARY : "rgba(255,255,255,0.3)" }}>
                      {day.weekday.slice(0, 3).toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: 16, fontFamily: "'Share Tech Mono', monospace",
                      color: dayIsToday ? PRIMARY : "rgba(255,255,255,0.5)",
                      marginBottom: 8, textShadow: dayIsToday ? `0 0 8px ${PRIMARY}55` : "none",
                    }}>
                      {day.date.slice(8, 10)}
                    </div>
                    {day.events.length === 0 && (
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.12)" }}>—</div>
                    )}
                    {day.events.slice(0, 4).map((e) => (
                      <div key={e.id} style={{
                        padding: "3px 5px", marginBottom: 3,
                        background: `${PRIMARY}08`, borderRadius: 3,
                        borderLeft: `2px solid ${PRIMARY}55`,
                      }}>
                        <div style={{ fontSize: 8, color: PRIMARY, fontFamily: "'Share Tech Mono', monospace" }}>
                          {timeOnly(e.start)}
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", lineHeight: 1.2 }}>
                          {e.summary.length > 18 ? e.summary.slice(0, 18) + "..." : e.summary}
                        </div>
                      </div>
                    ))}
                    {day.events.length > 4 && (
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                        +{day.events.length - 4} mais
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <ModuleChat
        module="agenda"
        label="AGENDA"
        color={PRIMARY}
        welcome="Posso ajudar a organizar sua semana, sugerir blocos de foco, reagendar compromissos ou analisar conflitos. O que precisa?"
        suggestions={["Resumo de hoje", "Blocos livres", "Proxima semana", "Otimizar agenda"]}
      />
    </ModuleShell>
  );
}

function MetricCard({ label, value, color, onClick }: { label: string; value: string; color: string; onClick?: () => void }): JSX.Element {
  return (
    <div onClick={onClick} style={{
      padding: "14px 16px",
      background: `${color}08`,
      border: `1px solid ${color}25`,
      borderRadius: 8,
      cursor: onClick ? "pointer" : "default",
    }}>
      <div className="hud-label" style={{ fontSize: 8, color: `${color}99`, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif" }}>{value}</div>
    </div>
  );
}
