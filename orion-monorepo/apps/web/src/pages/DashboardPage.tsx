import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api, request } from "../lib/api.js";

/* ═══════════════════════════════════════════════════════════════════
   ORION DASHBOARD — Painel inteligente de vida
   Widgets: Daily Brief · Agenda · Hábitos · Projetos · Tarefas · Humor
═══════════════════════════════════════════════════════════════════ */

const C = "#00D4FF";
const BG = "#030509";

// ─── Hooks ────────────────────────────────────────────────────────

function useDailyBrief(refresh = false) {
  return useQuery({
    queryKey: ["brief", refresh],
    queryFn: () => request<{
      date: string; greeting: string; summary: string; focusTip: string;
      agenda: Array<{ time: string; title: string; color: string }>;
      topTasks: Array<{ title: string; priority: number }>;
      habitStatus: { done: number; total: number; streak: number };
      mood: number | null; projectAlert: string | null; affirmation: string;
    }>(`/brief${refresh ? "?refresh=true" : ""}`),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

function useHabitsToday() {
  return useQuery({
    queryKey: ["habits", "today-dashboard"],
    queryFn: () => api.habits.list(),
    staleTime: 1000 * 60 * 2,
  });
}

function useTodayEvents() {
  return useQuery({
    queryKey: ["agenda", "today-dashboard"],
    queryFn: () => api.agenda.today(),
    staleTime: 1000 * 60 * 5,
  });
}

function useActiveProjects() {
  return useQuery({
    queryKey: ["projects", "dashboard"],
    queryFn: () => api.projects.list(),
    staleTime: 1000 * 60 * 5,
  });
}

function usePendingTasks() {
  return useQuery({
    queryKey: ["tasks", "dashboard"],
    queryFn: () => api.life.list({ status: "todo" }),
    staleTime: 1000 * 60 * 2,
  });
}

function useJournalToday() {
  return useQuery({
    queryKey: ["journal", "today-dashboard"],
    queryFn: () => api.journal.today(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// ─── Componentes ──────────────────────────────────────────────────

function BriefWidget(): JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();
  const { data: brief, isLoading, error } = useDailyBrief(false);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    await request("/brief?refresh=true");
    void qc.invalidateQueries({ queryKey: ["brief"] });
    setRefreshing(false);
  }

  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? "Manhã" : hour < 18 ? "Tarde" : "Noite";

  return (
    <div style={{
      gridColumn: "1 / -1",
      background: `linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(0,212,255,0.02) 100%)`,
      border: `1px solid rgba(0,212,255,0.2)`,
      borderRadius: 16,
      padding: "28px 32px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 300, height: 300,
        background: "radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.35em", color: `${C}80`, fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>
            ◈ ORION DAILY BRIEF · {timeLabel.toUpperCase()} · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
          </div>
          {isLoading ? (
            <div style={{ fontSize: 22, color: C, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
              Gerando briefing...
            </div>
          ) : brief ? (
            <div style={{ fontSize: 22, color: "#fff", fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>
              {brief.greeting}.
            </div>
          ) : (
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", fontFamily: "'Rajdhani', sans-serif" }}>
              Conecte-se para ver o briefing do dia
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          style={{
            background: "transparent",
            border: `1px solid ${C}30`,
            borderRadius: 8,
            color: refreshing ? `${C}60` : C,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            padding: "6px 14px",
            cursor: refreshing ? "wait" : "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
        >
          {refreshing ? "◌ GERANDO..." : "↻ REFRESH IA"}
        </button>
      </div>

      {brief && !isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Summary + Focus */}
          <div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, margin: "0 0 16px", fontFamily: "'Rajdhani', sans-serif" }}>
              {brief.summary}
            </p>
            <div style={{
              background: `rgba(0,212,255,0.08)`,
              border: `1px solid ${C}20`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: `${C}80`, fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>
                ▶ FOCO AGORA
              </div>
              <div style={{ fontSize: 13, color: C, fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
                {brief.focusTip}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", fontFamily: "'Rajdhani', sans-serif" }}>
              "{brief.affirmation}"
            </div>
          </div>

          {/* Stats rápidos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Hábitos */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>
                HÁBITOS HOJE
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    background: brief.habitStatus.total > 0
                      ? brief.habitStatus.done / brief.habitStatus.total >= 0.8 ? "#10B981" : C
                      : C,
                    width: brief.habitStatus.total > 0 ? `${(brief.habitStatus.done / brief.habitStatus.total) * 100}%` : "0%",
                    transition: "width 1s ease",
                    borderRadius: 2,
                  }} />
                </div>
                <span style={{ fontSize: 13, color: "#fff", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap" }}>
                  {brief.habitStatus.done}/{brief.habitStatus.total}
                </span>
              </div>
              {brief.habitStatus.streak > 0 && (
                <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>
                  🔥 {brief.habitStatus.streak} dias de streak
                </div>
              )}
            </div>

            {/* Project alert */}
            {brief.projectAlert && (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#F59E0B80", fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>
                  ⚠ PROJETO PARADO
                </div>
                <div style={{ fontSize: 12, color: "#F59E0B", fontFamily: "'Rajdhani', sans-serif" }}>
                  {brief.projectAlert}
                </div>
              </div>
            )}

            {/* Mood */}
            {brief.mood !== null && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>
                  HUMOR REGISTRADO
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: n <= (brief.mood ?? 0) ? C : "rgba(255,255,255,0.08)",
                      boxShadow: n <= (brief.mood ?? 0) ? `0 0 8px ${C}60` : "none",
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>
          ◌ Brief indisponível — verifique a API
        </div>
      )}
    </div>
  );
}

function AgendaWidget({ navigate }: { navigate: (path: string) => void }): JSX.Element {
  const { data: brief } = useDailyBrief(false);
  const agendaItems = brief?.agenda ?? [];

  return (
    <div style={widgetStyle}>
      <WidgetHeader label="AGENDA" icon="⬡" onClick={() => navigate("/m/agenda")} />
      {agendaItems.length === 0 ? (
        <EmptyState text="Agenda livre hoje" sub="Conecte o Google Calendar para ver eventos" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {agendaItems.map((e, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 0",
              borderBottom: i < agendaItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}>
              <div style={{
                width: 3, height: 32, borderRadius: 2,
                background: e.color ?? C, flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: 10, color: `${C}80`, fontFamily: "'Share Tech Mono', monospace" }}>{e.time}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif" }}>{e.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HabitsWidget({ navigate }: { navigate: (path: string) => void }): JSX.Element {
  const { data: habits, isLoading } = useHabitsToday();

  return (
    <div style={widgetStyle}>
      <WidgetHeader label="HÁBITOS" icon="◎" onClick={() => navigate("/m/habits")} />
      {isLoading ? <Loading /> : !habits?.length ? (
        <EmptyState text="Nenhum hábito criado" sub="Adicione hábitos para rastrear" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(habits as unknown as Array<Record<string, unknown>>).slice(0, 6).map((h, i) => {
            const done = Boolean(h.doneToday);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 0",
                opacity: done ? 1 : 0.6,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  background: done ? (h.color as string ?? C) : "transparent",
                  border: `1px solid ${h.color as string ?? C}60`,
                  boxShadow: done ? `0 0 8px ${h.color as string ?? C}40` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10,
                }}>
                  {done ? "✓" : ""}
                </div>
                <span style={{ fontSize: 12, color: done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", fontFamily: "'Rajdhani', sans-serif", flex: 1 }}>
                  {h.icon as string} {h.name as string}
                </span>
                {(h.streak as number) > 0 && (
                  <span style={{ fontSize: 10, color: "#F59E0B", fontFamily: "'Share Tech Mono', monospace" }}>
                    {h.streak as number}🔥
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TasksWidget({ navigate }: { navigate: (path: string) => void }): JSX.Element {
  const { data: brief } = useDailyBrief(false);
  const tasks = brief?.topTasks ?? [];

  const priorityColor = (p: number) => p >= 3 ? "#EF4444" : p === 2 ? "#F59E0B" : "rgba(255,255,255,0.3)";

  return (
    <div style={widgetStyle}>
      <WidgetHeader label="TAREFAS" icon="✓" onClick={() => navigate("/m/life")} />
      {tasks.length === 0 ? (
        <EmptyState text="Sem tarefas pendentes" sub="Tudo limpo por aqui" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 0",
              borderBottom: i < tasks.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 5,
                background: priorityColor(t.priority),
                boxShadow: `0 0 6px ${priorityColor(t.priority)}60`,
              }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.4 }}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectsWidget({ navigate }: { navigate: (path: string) => void }): JSX.Element {
  const { data: projects, isLoading } = useActiveProjects();

  return (
    <div style={widgetStyle}>
      <WidgetHeader label="PROJETOS" icon="◈" onClick={() => navigate("/m/projects")} />
      {isLoading ? <Loading /> : !projects?.length ? (
        <EmptyState text="Nenhum projeto" sub="Crie projetos para rastrear progresso" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(projects as Array<Record<string, unknown>>).slice(0, 4).map((p, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif" }}>
                  {p.name as string}
                </span>
                <span style={{ fontSize: 10, color: p.color as string ?? C, fontFamily: "'Share Tech Mono', monospace" }}>
                  {p.progress as number}%
                </span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${p.progress as number}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
                  style={{ height: "100%", background: p.color as string ?? C, borderRadius: 2 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JournalWidget({ navigate }: { navigate: (path: string) => void }): JSX.Element {
  const { data: today } = useJournalToday();
  const entry = today as Record<string, unknown> | null | undefined;
  const hasEntry = !!entry;
  const moodColors = ["", "#EF4444", "#F97316", "#F59E0B", "#10B981", "#00D4FF"];

  return (
    <div style={widgetStyle}>
      <WidgetHeader label="DIÁRIO" icon="✦" onClick={() => navigate("/m/journal")} />
      {hasEntry ? (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{
                width: 24, height: 24, borderRadius: "50%",
                background: n <= (entry?.mood as number ?? 0) ? moodColors[entry?.mood as number ?? 0] : "rgba(255,255,255,0.06)",
                border: n <= (entry?.mood as number ?? 0) ? "none" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: n <= (entry?.mood as number ?? 0) ? `0 0 10px ${moodColors[entry?.mood as number ?? 0]}50` : "none",
              }} />
            ))}
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginLeft: 4, alignSelf: "center" }}>
              HUMOR {entry?.mood as number}/5
            </span>
          </div>
          {Boolean(entry?.highlight) && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0, fontFamily: "'Rajdhani', sans-serif", fontStyle: "italic" }}>
              "{(entry.highlight as string).slice(0, 100)}{(entry.highlight as string).length > 100 ? "..." : ""}"
            </p>
          )}
          <div style={{ fontSize: 10, color: `${C}60`, marginTop: 10, fontFamily: "'Share Tech Mono', monospace" }}>
            ◉ REGISTRADO HOJE
          </div>
        </div>
      ) : (
        <div>
          <EmptyState text="Diário não registrado" sub="Que tal 2 minutos para capturar o dia?" />
          <button
            onClick={() => navigate("/m/journal")}
            style={{
              background: `${C}15`, border: `1px solid ${C}30`, borderRadius: 8,
              color: C, fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
              letterSpacing: "0.2em", padding: "8px 16px", cursor: "pointer",
              width: "100%", marginTop: 12, transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${C}25`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${C}15`; }}
          >
            + REGISTRAR AGORA
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Micro-componentes ────────────────────────────────────────────

function WidgetHeader({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: C, fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 9, letterSpacing: "0.3em", color: `${C}80`, fontFamily: "'Share Tech Mono', monospace" }}>
          {label}
        </span>
      </div>
      <button
        onClick={onClick}
        style={{
          background: "transparent", border: "none",
          color: "rgba(255,255,255,0.2)", fontSize: 10,
          cursor: "pointer", padding: 0, fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: "0.1em", transition: "color 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = C; }}
        onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}
      >
        VER TUDO →
      </button>
    </div>
  );
}

function EmptyState({ text, sub }: { text: string; sub: string }): JSX.Element {
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'Rajdhani', sans-serif" }}>{text}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 4, fontFamily: "'Rajdhani', sans-serif" }}>{sub}</div>
    </div>
  );
}

function Loading(): JSX.Element {
  return (
    <div style={{ textAlign: "center", padding: "12px 0", fontSize: 10, color: `${C}60`, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.2em" }}>
      ◌ CARREGANDO...
    </div>
  );
}

// ─── Estilo base de widget ────────────────────────────────────────

const widgetStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "20px 22px",
  transition: "border-color 0.2s",
};

// ─── Barra de status do sistema ───────────────────────────────────

function SystemStatus(): JSX.Element {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 24,
      marginBottom: 28, paddingBottom: 16,
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#10B981", boxShadow: "0 0 8px #10B98180",
          animation: "pulse 2s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 9, letterSpacing: "0.35em", color: "#10B981", fontFamily: "'Share Tech Mono', monospace" }}>
          ORION ONLINE
        </span>
      </div>
      <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>
        {time.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase()}
      </span>
      <span style={{ fontSize: 9, letterSpacing: "0.2em", color: C, fontFamily: "'Share Tech Mono', monospace", marginLeft: "auto" }}>
        {time.toLocaleTimeString("pt-BR")}
      </span>
    </div>
  );
}

// ─── Page principal ───────────────────────────────────────────────

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: "32px", fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <SystemStatus />

      {/* Grid de widgets */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}>
        {/* Brief — full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ gridColumn: "1 / -1" }}
        >
          <BriefWidget />
        </motion.div>

        {/* Agenda */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <AgendaWidget navigate={navigate} />
        </motion.div>

        {/* Tarefas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <TasksWidget navigate={navigate} />
        </motion.div>

        {/* Hábitos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <HabitsWidget navigate={navigate} />
        </motion.div>

        {/* Projetos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} style={{ gridColumn: "1 / span 2" }}>
          <ProjectsWidget navigate={navigate} />
        </motion.div>

        {/* Diário */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <JournalWidget navigate={navigate} />
        </motion.div>
      </div>
    </div>
  );
}
