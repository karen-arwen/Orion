import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { ProactiveAlert, Project, UserProfile, UserVitals } from "@orion/types";
import type { Task } from "@orion/types";
import { api } from "../../lib/api.js";
import { RingGauge } from "../visual/RingGauge.js";
import { MiniCalendar } from "../visual/MiniCalendar.js";
import { MomentumWidget } from "../visual/MomentumWidget.js";
import { StreaksHeatmap } from "../visual/StreaksHeatmap.js";
import { useMomentum } from "../../hooks/useMomentum.js";
import { MemoryCenter } from "./MemoryCenter.js";

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD INTELIGENTE — muda com a hora do dia.

   Manhã (5h–12h):  Morning Brief + Agenda + Tarefas prioritárias
   Tarde (12h–18h): Progresso do dia + Foco + Hábitos pendentes
   Noite (18h–5h):  Resumo do dia + Sono + Prep do amanhã

   Sempre mostra: vitals, alertas críticos, ação sugerida.
═══════════════════════════════════════════════════════════════════ */

type TimeOfDay = "morning" | "afternoon" | "night";

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "night";
}

function getGreeting(name: string, time: TimeOfDay): string {
  const firstName = name.split(" ")[0];
  if (time === "morning") return `Bom dia, ${firstName}`;
  if (time === "afternoon") return `Boa tarde, ${firstName}`;
  return `Boa noite, ${firstName}`;
}

function getTimeLabel(time: TimeOfDay): string {
  if (time === "morning") return "MORNING BRIEF";
  if (time === "afternoon") return "AFTERNOON CHECK";
  return "EVENING REVIEW";
}

function getTimeColor(time: TimeOfDay): string {
  if (time === "morning") return "#F59E0B";
  if (time === "afternoon") return "#00D4FF";
  return "#7C3AED";
}

interface DashPanelProps {
  profile: UserProfile;
  projects: Project[];
  alerts: ProactiveAlert[];
  connectedProviders: string[];
  vitals: UserVitals;
  onSendToChat: (text: string) => void;
}

interface DashData {
  tasks: Task[];
  habits: Array<{ id: string; name: string; streak: number; doneToday: boolean }>;
  sleepStats: { avgHours: number; avgQuality: number; lastNight: number | null };
  focusToday: { minutes: number; sessions: number };
  morningBrief: string | null;
}

const card = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: "14px 16px",
  background: "rgba(255,255,255,0.018)",
  border: `1px solid ${color}18`,
  borderRadius: 10,
  ...extra,
});

const label: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "'Share Tech Mono', monospace",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const mono: React.CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace",
};

export function DashPanel({
  profile,
  projects,
  alerts,
  connectedProviders,
  vitals,
  onSendToChat,
}: DashPanelProps): JSX.Element {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const momentum = useMomentum();
  const time = getTimeOfDay();
  const c = profile.theme.primary;
  const timeColor = getTimeColor(time);

  useEffect(() => {
    let alive = true;
    async function load(): Promise<void> {
      try {
        const [tasksRes, habitsRes, sleepRes, focusRes] = await Promise.all([
          api.life.list().catch(() => [] as Task[]),
          api.habits.list().catch(() => []),
          api.sleep.stats().catch(() => null),
          api.focus.today().catch(() => []),
        ]);

        // Get morning brief from alerts
        const briefAlert = alerts.find(
          (a) => a.title?.includes("Morning Brief"),
        );

        const activeTasks = (tasksRes as Task[]).filter(
          (t: Task) => t.status === "todo" || t.status === "doing",
        );

        const today = new Date().toISOString().slice(0, 10);
        const habitsList = (habitsRes as Array<{ id: string; name: string; streak: number; recentLogs: Record<string, boolean> }>).map((h) => ({
          id: h.id,
          name: h.name,
          streak: h.streak,
          doneToday: h.recentLogs?.[today] ?? false,
        }));

        const focusSessions = focusRes as Array<{ completed: boolean; actualMinutes: number | null; duration: number }>;
        const focusMins = focusSessions.reduce((sum, f) => sum + (f.actualMinutes ?? f.duration ?? 0), 0);

        const sleepData = sleepRes as { avgDurationMin: number; avgQuality: number; samplesLast7Days: number } | null;

        if (alive) {
          setData({
            tasks: activeTasks.sort((a: Task, b: Task) => b.priority - a.priority).slice(0, 6),
            habits: habitsList,
            sleepStats: {
              avgHours: sleepData ? Math.round((sleepData.avgDurationMin / 60) * 10) / 10 : 0,
              avgQuality: sleepData?.avgQuality ?? 0,
              lastNight: null,
            },
            focusToday: { minutes: focusMins, sessions: focusSessions.length },
            morningBrief: briefAlert?.text ?? null,
          });
          setLoading(false);
        }
      } catch {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [alerts]);

  const criticalAlerts = alerts.filter((a) => a.priority === "high" || a.priority === "critical");
  const activeProjects = projects.filter((p) => p.status !== "archived");
  const dayProgress = Math.min(100, Math.round(((new Date().getHours() - 5) / 16) * 100));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ overflowY: "auto", padding: "20px 22px", flex: 1 }}
    >
      {/* Header contextual */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ ...label, color: timeColor, fontSize: 10, marginBottom: 4 }}>
              {getTimeLabel(time)}
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 600,
              fontFamily: "'Rajdhani', sans-serif",
              color: "rgba(255,255,255,0.88)",
            }}>
              {getGreeting(profile.name, time)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <RingGauge
              value={dayProgress}
              size={52}
              thickness={4}
              color={timeColor}
              centerLabel={`${dayProgress}%`}
              bottomLabel="DIA"
            />
          </div>
        </div>
      </motion.div>

      {/* Momentum Score — hero widget */}
      {momentum.data && <MomentumWidget data={momentum.data} color={c} />}

      {/* Streaks heatmap */}
      <StreaksHeatmap
        data={Object.fromEntries(
          (data?.habits ?? [])
            .filter((h) => h.doneToday)
            .map((h) => [new Date().toISOString().slice(0, 10), 1]),
        )}
        color={c}
        maxPerDay={data?.habits.length ?? 1}
      />

      {/* Vitals compactos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { lbl: "ENERGIA", val: `${vitals.energy}%`, col: vitals.energy < 45 ? "#F59E0B" : "#10B981" },
          { lbl: "FOCO", val: `${vitals.focus}%`, col: profile.theme.secondary },
          { lbl: "MODO", val: profile.mode, col: profile.theme.accent },
          { lbl: "CONECTORES", val: String(connectedProviders.length), col: connectedProviders.length ? "#10B981" : "#F59E0B" },
        ].map((v, i) => (
          <motion.div
            key={v.lbl}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}
            whileHover={{ scale: 1.04, transition: { duration: 0.15 } }}
            style={{
              ...card(v.col),
              padding: "10px 12px",
              borderLeft: `3px solid ${v.col}`,
              cursor: "default",
            }}
          >
            <div style={{ ...label, fontSize: 7 }}>{v.lbl}</div>
            <div style={{ ...mono, fontSize: 18, color: v.col, textShadow: `0 0 12px ${v.col}30` }}>
              {v.val}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Alertas críticos (sempre visível se houver) */}
      {/* Mini-calendar com indicadores de tarefas */}
      <MiniCalendar
        color={c}
        eventDays={new Set(
          (data?.tasks ?? [])
            .filter((t) => t.dueAt)
            .map((t) => new Date(t.dueAt!).getDate()),
        )}
        deadlineDays={new Set(
          (data?.tasks ?? [])
            .filter((t) => t.dueAt && t.priority >= 3)
            .map((t) => new Date(t.dueAt!).getDate()),
        )}
      />

      {criticalAlerts.length > 0 && (
        <div style={{ ...card("#EF4444", { borderLeft: "3px solid #EF4444", marginBottom: 16 }) }}>
          <div style={{ ...label, color: "#EF4444" }}>
            {criticalAlerts.length} ALERTA{criticalAlerts.length > 1 ? "S" : ""} CRITICO{criticalAlerts.length > 1 ? "S" : ""}
          </div>
          {criticalAlerts.slice(0, 3).map((a) => (
            <div key={a.id} style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ color: "#EF4444", marginRight: 8 }}>{a.icon ?? "!"}</span>
              {a.title}
            </div>
          ))}
        </div>
      )}

      {/* === CONTEÚDO CONTEXTUAL POR HORA === */}

      {time === "morning" && (
        <>
          {/* Morning Brief */}
          {data?.morningBrief && (
            <div style={{ ...card(c, { marginBottom: 16, borderLeft: `3px solid ${timeColor}` }) }}>
              <div style={{ ...label, color: timeColor }}>BRIEFING DO DIA</div>
              <div style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}>
                {data.morningBrief}
              </div>
            </div>
          )}

          {/* Tarefas prioritárias do dia */}
          <div style={{ ...card(c, { marginBottom: 16 }) }}>
            <div style={{ ...label, color: c }}>PRIORIDADES DO DIA</div>
            {loading ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Carregando...</div>
            ) : data?.tasks.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Nenhuma tarefa aberta. Dia livre?</div>
            ) : (
              data?.tasks.slice(0, 5).map((t, i) => (
                <div key={t.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i < (data?.tasks.length ?? 0) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      ...mono,
                      fontSize: 9,
                      color: t.priority >= 3 ? "#EF4444" : t.priority >= 2 ? "#F59E0B" : "rgba(255,255,255,0.3)",
                    }}>
                      P{t.priority}
                    </span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{t.title}</span>
                  </div>
                  {t.dueAt && (
                    <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                      {new Date(t.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick action */}
          <button
            onClick={() => onSendToChat("Monte meu plano de acao para hoje. Considere minhas tarefas, agenda, nivel de energia e prioridades.")}
            className="orion-command"
            style={{
              width: "100%",
              padding: "12px",
              color: timeColor,
              borderColor: `${timeColor}55`,
              background: `${timeColor}14`,
              marginBottom: 16,
            }}
          >
            PLANEJAR MEU DIA
          </button>
        </>
      )}

      {time === "afternoon" && (
        <>
          {/* Progresso do dia */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ ...card(c) }}>
              <div style={{ ...label, color: c }}>FOCO HOJE</div>
              <div style={{ ...mono, fontSize: 28, color: c }}>
                {data?.focusToday.minutes ?? 0}<span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>min</span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                {data?.focusToday.sessions ?? 0} sessoes
              </div>
            </div>
            <div style={{ ...card(profile.theme.secondary) }}>
              <div style={{ ...label, color: profile.theme.secondary }}>TAREFAS</div>
              <div style={{ ...mono, fontSize: 28, color: profile.theme.secondary }}>
                {data?.tasks.filter((t) => t.status === "doing").length ?? 0}
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  /{data?.tasks.length ?? 0}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>em andamento</div>
            </div>
          </div>

          {/* Hábitos pendentes */}
          <div style={{ ...card(profile.theme.accent, { marginBottom: 16 }) }}>
            <div style={{ ...label, color: profile.theme.accent }}>HABITOS DO DIA</div>
            {data?.habits.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Nenhum habito ativo.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {data?.habits.map((h) => (
                  <div key={h.id} style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    border: `1px solid ${h.doneToday ? "#10B981" : "rgba(255,255,255,0.1)"}`,
                    color: h.doneToday ? "#10B981" : "rgba(255,255,255,0.5)",
                    background: h.doneToday ? "#10B98112" : "transparent",
                  }}>
                    {h.doneToday ? "✓" : "○"} {h.name}
                    {h.streak > 0 && (
                      <span style={{ ...mono, fontSize: 9, marginLeft: 6, color: "#F59E0B" }}>{h.streak}d</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarefas em andamento */}
          {(data?.tasks.filter((t) => t.status === "doing").length ?? 0) > 0 && (
            <div style={{ ...card(c, { marginBottom: 16 }) }}>
              <div style={{ ...label, color: c }}>EM ANDAMENTO</div>
              {data?.tasks.filter((t) => t.status === "doing").map((t) => (
                <div key={t.id} style={{ padding: "6px 0", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {t.title}
                  {t.estMinutes && (
                    <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>
                      ~{t.estMinutes}min
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onSendToChat("Como estou indo hoje? Analise meu progresso, foco e habitos e sugira ajustes para o resto do dia.")}
            className="orion-command"
            style={{
              width: "100%",
              padding: "12px",
              color: timeColor,
              borderColor: `${timeColor}55`,
              background: `${timeColor}14`,
              marginBottom: 16,
            }}
          >
            CHECK DO DIA
          </button>
        </>
      )}

      {time === "night" && (
        <>
          {/* Resumo do dia */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ ...card("#10B981"), textAlign: "center" }}>
              <div style={{ ...label, color: "#10B981" }}>FOCO</div>
              <div style={{ ...mono, fontSize: 22, color: "#10B981" }}>{data?.focusToday.minutes ?? 0}m</div>
            </div>
            <div style={{ ...card(profile.theme.accent), textAlign: "center" }}>
              <div style={{ ...label, color: profile.theme.accent }}>HABITOS</div>
              <div style={{ ...mono, fontSize: 22, color: profile.theme.accent }}>
                {data?.habits.filter((h) => h.doneToday).length ?? 0}/{data?.habits.length ?? 0}
              </div>
            </div>
            <div style={{ ...card(profile.theme.secondary), textAlign: "center" }}>
              <div style={{ ...label, color: profile.theme.secondary }}>SONO MED</div>
              <div style={{ ...mono, fontSize: 22, color: profile.theme.secondary }}>
                {data?.sleepStats.avgHours ?? "—"}h
              </div>
            </div>
          </div>

          {/* Tarefas pendentes pro amanhã */}
          {(data?.tasks.length ?? 0) > 0 && (
            <div style={{ ...card(c, { marginBottom: 16 }) }}>
              <div style={{ ...label, color: c }}>PENDENTE PARA AMANHA</div>
              {data?.tasks.slice(0, 4).map((t) => (
                <div key={t.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                }}>
                  <span>{t.title}</span>
                  <span style={{ ...mono, fontSize: 9, color: t.priority >= 3 ? "#EF4444" : "rgba(255,255,255,0.2)" }}>
                    P{t.priority}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sugestão de sono */}
          <div style={{ ...card("#7C3AED", { marginBottom: 16, borderLeft: "3px solid #7C3AED" }) }}>
            <div style={{ ...label, color: "#7C3AED" }}>SONO</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              {data?.sleepStats.avgHours
                ? data.sleepStats.avgHours < 7
                  ? `Media de ${data.sleepStats.avgHours}h nos ultimos dias. Tente dormir mais cedo hoje.`
                  : `Media de ${data.sleepStats.avgHours}h — bom ritmo. Mantenha a consistencia.`
                : "Sem dados de sono recentes. Registre hoje para insights melhores."
              }
            </div>
          </div>

          <button
            onClick={() => onSendToChat("Faca um resumo do meu dia e prepare o amanha. O que ficou pendente? O que priorizar? Como esta minha energia e sono?")}
            className="orion-command"
            style={{
              width: "100%",
              padding: "12px",
              color: timeColor,
              borderColor: `${timeColor}55`,
              background: `${timeColor}14`,
              marginBottom: 16,
            }}
          >
            PREPARAR AMANHA
          </button>
        </>
      )}

      {/* Projetos (sempre visível) */}
      {activeProjects.length > 0 && (
        <div style={{ ...card(c, { marginBottom: 16 }) }}>
          <div style={{ ...label, color: c }}>PROJETOS</div>
          {activeProjects.slice(0, 4).map((p) => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{p.name}</span>
                <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                  {p.progress}%
                </span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2 }}>
                <div style={{
                  width: `${p.progress}%`,
                  height: "100%",
                  background: p.color,
                  borderRadius: 2,
                  boxShadow: `0 0 5px ${p.color}60`,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <MemoryCenter color={c} onSendToChat={onSendToChat} />
    </motion.div>
  );
}
