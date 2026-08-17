import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useRoutines, useRoutineToday, useCreateRoutine, useDeleteRoutine,
  useStartRoutine, useCompleteStep, useRoutineHistory, useUpdateRoutine,
} from "../../hooks/modules/useRoutine.js";

const CYAN   = "#00D4FF";
const GOLD   = "#F59E0B";
const GREEN  = "#10B981";
const PURPLE = "#7C3AED";
const RED    = "#EF4444";

type StepType = "task" | "checkin" | "timer" | "note" | "habit";
type Frequency = "daily" | "weekdays" | "weekends" | "custom";

const STEP_ICONS: Record<StepType, string> = {
  task: "◈", checkin: "◎", timer: "◌", note: "✎", habit: "▸",
};

const FREQ_LABELS: Record<Frequency, string> = {
  daily: "Todos os dias",
  weekdays: "Segunda a Sexta",
  weekends: "Fins de semana",
  custom: "Personalizado",
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

/* ── Step definition for the builder ── */
interface StepDraft {
  id: string; label: string; type: StepType; durationMin?: number;
}

/* ── Streak heatmap (last 14 days) ── */
function MiniCalendar({ history }: { history: Array<{ date: string; finished: boolean }> }): JSX.Element {
  const days: Array<{ label: string; finished: boolean; date: string }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = history.find(h => h.date === dateStr);
    days.push({ label: DAY_LABELS[d.getDay()] ?? "", finished: !!entry?.finished, date: dateStr });
  }
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {days.map(d => (
        <div key={d.date} title={d.date} style={{
          width: 22, height: 22, borderRadius: 4,
          background: d.finished ? `${GREEN}40` : "rgba(255,255,255,0.04)",
          border: `1px solid ${d.finished ? GREEN + "60" : "rgba(255,255,255,0.06)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, color: d.finished ? GREEN : "rgba(255,255,255,0.2)",
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          {d.label[0]}
        </div>
      ))}
    </div>
  );
}

/* ── Active runner panel ── */
interface RunnerProps {
  routine: { id: string; name: string; icon: string; steps: StepDraft[]; totalXp: number };
  onClose: () => void;
}

function RoutineRunner({ routine, onClose }: RunnerProps): JSX.Element {
  const { data: log } = useRoutineToday(routine.id);
  const startRoutine  = useStartRoutine();
  const completeStep  = useCompleteStep();
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (log && !log.finished) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [log?.finished]);

  useEffect(() => {
    if (!log) { void startRoutine.mutateAsync(routine.id); }
  }, []);

  const completedSet = new Set(log?.completedSteps ?? []);
  const pct = routine.steps.length > 0 ? Math.round((completedSet.size / routine.steps.length) * 100) : 0;
  const fmt = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(3,5,9,0.92)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        width: "min(520px, 95vw)",
        background: "rgba(3,5,9,0.98)",
        border: `1px solid ${CYAN}30`,
        borderRadius: 16,
        boxShadow: `0 0 60px ${CYAN}18`,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid rgba(255,255,255,0.06)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{routine.icon}</span>
              <span style={{ fontSize: 14, fontFamily: "'Share Tech Mono', monospace", color: CYAN, letterSpacing: "0.1em" }}>{routine.name}</span>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>
              {completedSet.size}/{routine.steps.length} ETAPAS · {fmt(elapsed)} · +{routine.totalXp} XP
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        {/* XP Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.04)" }}>
          <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }}
            style={{ height: "100%", background: `linear-gradient(90deg, ${CYAN}, ${PURPLE})` }} />
        </div>

        {/* Steps */}
        <div style={{ padding: "16px 24px", maxHeight: "50vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {log?.finished ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 14, fontFamily: "'Share Tech Mono', monospace", color: GREEN, letterSpacing: "0.1em", marginBottom: 6 }}>
                ROTINA CONCLUIDA
              </div>
              {"streak" in (log ?? {}) && (log as { streak?: number }).streak! > 1 && (
                <div style={{ fontSize: 10, color: GOLD, fontFamily: "'Share Tech Mono', monospace" }}>
                  {(log as { streak?: number }).streak} dias consecutivos
                </div>
              )}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginTop: 8 }}>
                +{routine.totalXp} XP ganhos
              </div>
              <button onClick={onClose} style={{ marginTop: 20, padding: "10px 24px", background: `${GREEN}15`, border: `1px solid ${GREEN}40`, color: GREEN, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
                FECHAR
              </button>
            </motion.div>
          ) : (
            routine.steps.map((step, i) => {
              const done = completedSet.has(step.id);
              const isCurrent = !done && i === routine.steps.findIndex(s => !completedSet.has(s.id));
              return (
                <motion.div key={step.id} layout
                  style={{
                    padding: "12px 16px",
                    background: done ? `${GREEN}08` : isCurrent ? `${CYAN}08` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${done ? GREEN + "30" : isCurrent ? CYAN + "30" : "rgba(255,255,255,0.05)"}`,
                    borderRadius: 10,
                    display: "flex", alignItems: "center", gap: 14,
                    cursor: done ? "default" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => { if (!done) void completeStep.mutateAsync({ id: routine.id, stepId: step.id }); }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: done ? `${GREEN}25` : isCurrent ? `${CYAN}15` : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${done ? GREEN + "60" : isCurrent ? CYAN + "50" : "rgba(255,255,255,0.08)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: done ? 14 : 13,
                    color: done ? GREEN : isCurrent ? CYAN : "rgba(255,255,255,0.3)",
                    transition: "all 0.2s ease",
                  }}>
                    {done ? "✓" : STEP_ICONS[step.type]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: done ? `${GREEN}80` : "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", textDecoration: done ? "line-through" : "none" }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
                      {step.type.toUpperCase()}{step.durationMin ? ` · ${step.durationMin}min` : ""}
                    </div>
                  </div>
                  {isCurrent && !done && (
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN }} />
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Builder modal ── */
interface BuilderProps { onSave: (data: Record<string, unknown>) => void; onClose: () => void; }
function RoutineBuilder({ onSave, onClose }: BuilderProps): JSX.Element {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("◈");
  const [freq, setFreq] = useState<Frequency>("daily");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [newStep, setNewStep] = useState("");
  const [newStepType, setNewStepType] = useState<StepType>("task");
  const [newStepDur, setNewStepDur] = useState("");

  const addStep = (): void => {
    if (!newStep.trim()) return;
    setSteps(s => [...s, { id: `s_${Date.now()}`, label: newStep.trim(), type: newStepType, durationMin: newStepDur ? Number(newStepDur) : undefined }]);
    setNewStep(""); setNewStepDur("");
  };

  const removeStep = (id: string): void => setSteps(s => s.filter(x => x.id !== id));

  const save = (): void => {
    if (!name.trim() || steps.length === 0) return;
    onSave({ name: name.trim(), icon, frequency: freq, steps, active: true, totalXp: 0 });
  };

  const ICONS = ["◈", "▸", "◉", "◎", "⬡", "✦", "◌", "▲", "◧", "✎"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(3,5,9,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: "min(560px, 95vw)", background: "rgba(3,5,9,0.98)", border: `1px solid ${PURPLE}40`, borderRadius: 16, overflow: "hidden", boxShadow: `0 0 60px ${PURPLE}18` }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "'Share Tech Mono', monospace", color: PURPLE, letterSpacing: "0.1em" }}>NOVA ROTINA</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "75vh", overflowY: "auto" }}>
          {/* Name + icon */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, width: 140 }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)} style={{
                  width: 30, height: 30, background: icon === ic ? `${PURPLE}30` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${icon === ic ? PURPLE + "60" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 6, fontSize: 14, cursor: "pointer", color: "rgba(255,255,255,0.7)",
                }}>{ic}</button>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>NOME DA ROTINA</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Rotina Matinal"
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>FREQUENCIA</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.entries(FREQ_LABELS) as [Frequency, string][]).map(([k, v]) => (
                <button key={k} onClick={() => setFreq(k)} style={{
                  padding: "6px 14px", background: freq === k ? `${CYAN}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${freq === k ? CYAN + "50" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 6, color: freq === k ? CYAN : "rgba(255,255,255,0.4)",
                  fontFamily: "'Share Tech Mono', monospace", fontSize: 9, cursor: "pointer",
                }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 8 }}>ETAPAS ({steps.length})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {steps.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, width: 14, textAlign: "center" }}>{i + 1}</span>
                  <span style={{ color: CYAN, fontSize: 12 }}>{STEP_ICONS[s.type]}</span>
                  <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "'Rajdhani', sans-serif" }}>{s.label}</span>
                  {s.durationMin && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>{s.durationMin}min</span>}
                  <button onClick={() => removeStep(s.id)} style={{ background: "none", border: "none", color: `${RED}60`, cursor: "pointer", fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
            {/* Add step */}
            <div style={{ display: "flex", gap: 8 }}>
              <select value={newStepType} onChange={e => setNewStepType(e.target.value as StepType)}
                style={{ padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, outline: "none" }}>
                {(Object.keys(STEP_ICONS) as StepType[]).map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && addStep()} placeholder="Descricao da etapa..."
                style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none" }} />
              <input value={newStepDur} onChange={e => setNewStepDur(e.target.value)} placeholder="min" type="number"
                style={{ width: 48, padding: "8px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, outline: "none" }} />
              <button onClick={addStep} style={{ padding: "8px 14px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>+</button>
            </div>
          </div>

          <button onClick={save} disabled={!name.trim() || steps.length === 0}
            style={{ padding: "12px", background: `linear-gradient(135deg, ${CYAN}20, ${PURPLE}20)`, border: `1px solid ${CYAN}40`, color: CYAN, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: "0.1em", opacity: (!name.trim() || steps.length === 0) ? 0.4 : 1 }}>
            CRIAR ROTINA
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Routine Card ── */
interface CardProps {
  routine: { id: string; name: string; icon: string; steps: Array<{ id: string; label: string; type: string; durationMin?: number }>; active: boolean; frequency: string; totalXp: number };
  onRun: () => void;
  onDelete: () => void;
}

function RoutineCard({ routine, onRun, onDelete }: CardProps): JSX.Element {
  const { data: log } = useRoutineToday(routine.id);
  const { data: history } = useRoutineHistory(routine.id, 14);
  const done = log?.finished ?? false;
  const completedToday = log?.completedSteps?.length ?? 0;
  const pct = routine.steps.length > 0 ? Math.round((completedToday / routine.steps.length) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      style={{
        padding: "18px 20px",
        background: done ? `linear-gradient(135deg, ${GREEN}08, rgba(255,255,255,0.02))` : "rgba(255,255,255,0.02)",
        border: `1px solid ${done ? GREEN + "30" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {done && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: GREEN }} />}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: done ? `${GREEN}15` : `${CYAN}10`,
          border: `1px solid ${done ? GREEN + "40" : CYAN + "25"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, color: done ? GREEN : CYAN,
        }}>
          {done ? "✓" : routine.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{routine.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>
              {FREQ_LABELS[routine.frequency as Frequency] ?? routine.frequency}
            </span>
            <span style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "inline-block" }} />
            <span style={{ fontSize: 9, color: GOLD, fontFamily: "'Share Tech Mono', monospace" }}>+{routine.totalXp} XP</span>
          </div>
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 16, padding: 4, flexShrink: 0 }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = RED; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.15)"; }}>×</button>
      </div>

      {/* Progress */}
      {!done && completedToday > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <motion.div animate={{ width: `${pct}%` }} style={{ height: "100%", background: CYAN, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>{pct}%</span>
        </div>
      )}

      {/* Heatmap */}
      {history && history.length > 0 && <MiniCalendar history={history} />}

      {/* Steps preview */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {routine.steps.slice(0, 5).map((s, i) => (
          <span key={i} style={{ fontSize: 9, padding: "2px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, color: "rgba(255,255,255,0.4)", fontFamily: "'Rajdhani', sans-serif" }}>
            {s.label}
          </span>
        ))}
        {routine.steps.length > 5 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>+{routine.steps.length - 5}</span>}
      </div>

      <button onClick={onRun}
        style={{
          padding: "10px", width: "100%",
          background: done ? `${GREEN}10` : `${CYAN}12`,
          border: `1px solid ${done ? GREEN + "30" : CYAN + "30"}`,
          color: done ? GREEN : CYAN,
          borderRadius: 8, cursor: "pointer",
          fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
        }}>
        {done ? "✓ CONCLUIDA HOJE" : completedToday > 0 ? `CONTINUAR (${completedToday}/${routine.steps.length})` : "INICIAR ROTINA"}
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export function RoutinePage(): JSX.Element {
  const { data: routines = [], isLoading } = useRoutines();
  const createRoutine  = useCreateRoutine();
  const deleteRoutine  = useDeleteRoutine();
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeRunner, setActiveRunner] = useState<string | null>(null);

  const activeRoutine = routines.find(r => r.id === activeRunner);
  const todayDone  = routines.filter(_ => false).length; // computed per card

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#030509", color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ color: CYAN, fontSize: 18 }}>◎</span>
            <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Share Tech Mono', monospace", color: CYAN, letterSpacing: "0.15em", textShadow: `0 0 18px ${CYAN}40` }}>
              ROTINAS
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>
            {routines.length} rotina{routines.length !== 1 ? "s" : ""} configurada{routines.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowBuilder(true)}
          style={{ padding: "10px 20px", background: `${CYAN}15`, border: `1px solid ${CYAN}40`, color: CYAN, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
          + NOVA ROTINA
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: 80, color: CYAN, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
          ◌ CARREGANDO ROTINAS…
        </div>
      )}

      {/* Empty */}
      {!isLoading && routines.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>◎</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 20 }}>
            NENHUMA ROTINA CONFIGURADA
          </div>
          <button onClick={() => setShowBuilder(true)}
            style={{ padding: "12px 28px", background: `${CYAN}15`, border: `1px solid ${CYAN}40`, color: CYAN, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>
            CRIAR PRIMEIRA ROTINA
          </button>
        </motion.div>
      )}

      {/* Grid */}
      {routines.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {routines.map(r => (
            <RoutineCard
              key={r.id}
              routine={r}
              onRun={() => setActiveRunner(r.id)}
              onDelete={() => { void deleteRoutine.mutateAsync(r.id); }}
            />
          ))}
        </div>
      )}

      {/* Builder modal */}
      <AnimatePresence>
        {showBuilder && (
          <RoutineBuilder
            onSave={data => {
              void createRoutine.mutateAsync(data).then(() => setShowBuilder(false));
            }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </AnimatePresence>

      {/* Runner overlay */}
      <AnimatePresence>
        {activeRunner && activeRoutine && (
          <RoutineRunner
            routine={activeRoutine as { id: string; name: string; icon: string; steps: StepDraft[]; totalXp: number }}
            onClose={() => setActiveRunner(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
