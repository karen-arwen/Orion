import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useCompleteFocus, useFocusToday, useFocusWeekly, useInterruptFocus, useStartFocus } from "../../hooks/modules/useFocus.js";

const PRIMARY = "#00D4FF";

const FOCUS_MODES = [
  { label: "Pomodoro", duration: 25, icon: "\u{1F345}", desc: "25min foco + 5min pausa" },
  { label: "Deep Work", duration: 45, icon: "\u{1F9E0}", desc: "45min imersão total" },
  { label: "Sprint", duration: 15, icon: "⚡", desc: "15min tarefa rápida" },
  { label: "Maratona", duration: 90, icon: "\u{1F3C3}", desc: "90min bloco produtivo" },
];

const STUDY_LINKS = [
  { label: "IDIOMAS", to: "/m/language", icon: "\u{1F30D}", color: "#3B82F6" },
  { label: "CONHECIMENTO", to: "/m/know", icon: "\u{1F4DA}", color: "#F59E0B" },
  { label: "CARREIRA", to: "/m/career", icon: "↑", color: "#7C3AED" },
];

export function FocusPage(): JSX.Element {
  const [duration, setDuration] = useState(25);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStart, setActiveStart] = useState<number | null>(null);
  const [activeDur, setActiveDur] = useState<number>(25);
  const [elapsed, setElapsed] = useState(0);
  const [label, setLabel] = useState("");

  const start = useStartFocus();
  const complete = useCompleteFocus();
  const interrupt = useInterruptFocus();
  const { data: today } = useFocusToday();
  const { data: weekly } = useFocusWeekly();

  useEffect(() => {
    if (!activeStart) return;
    const tick = (): void => setElapsed(Math.floor((Date.now() - activeStart) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeStart]);

  const handleStart = (): void => { start.mutate(duration, { onSuccess: (s) => { setActiveId(s.id); setActiveStart(new Date(s.startedAt).getTime()); setActiveDur(s.duration); } }); };
  const handleComplete = (): void => { if (!activeId) return; complete.mutate(activeId, { onSuccess: () => { setActiveId(null); setActiveStart(null); setElapsed(0); } }); };
  const handleInterrupt = (): void => { if (!activeId) return; interrupt.mutate(activeId, { onSuccess: () => { setActiveId(null); setActiveStart(null); setElapsed(0); } }); };

  const totalSec = activeDur * 60;
  const progress = Math.min(1, elapsed / totalSec);
  const remaining = Math.max(0, totalSec - elapsed);
  const radius = 90;
  const circ = 2 * Math.PI * radius;
  const dash = progress * circ;
  const min = String(activeId ? Math.floor(remaining / 60) : duration).padStart(2, "0");
  const sec = String(activeId ? remaining % 60 : 0).padStart(2, "0");
  const isTimerDone = activeId !== null && elapsed >= totalSec;

  const maxMin = weekly?.reduce((a, b) => Math.max(a, b.minutes), 0) ?? 0;
  const totalWeekMin = weekly?.reduce((a, b) => a + b.minutes, 0) ?? 0;
  const todayMin = today?.reduce((a, b) => a + (b.actualMinutes ?? 0), 0) ?? 0;
  const todaySessions = today?.length ?? 0;
  const todayCompleted = today?.filter((s) => s.completed).length ?? 0;
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <ModuleShell icon="◐" label="FOCO" sub="Pomodoro · Flow · Concentração" color={PRIMARY}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 24 }}>
          <MiniStat label="HOJE" value={`${todayMin}min`} color={todayMin > 0 ? PRIMARY : "rgba(255,255,255,0.3)"} />
          <MiniStat label="SESSÕES" value={`${todayCompleted}/${todaySessions}`} color={todayCompleted > 0 ? "#10B981" : "rgba(255,255,255,0.3)"} />
          <MiniStat label="SEMANA" value={`${Math.round(totalWeekMin / 60)}h${totalWeekMin % 60}m`} color="#7C3AED" />
        </div>

        {/* Timer */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <motion.div animate={isTimerDone ? { scale: [1, 1.02, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
            <svg width={220} height={220} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={110} cy={110} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
              <circle cx={110} cy={110} r={radius} fill="none" stroke={isTimerDone ? "#10B981" : PRIMARY} strokeWidth={4} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s linear", filter: activeId ? `drop-shadow(0 0 10px ${isTimerDone ? "#10B981" : PRIMARY})` : "none" }} />
            </svg>
          </motion.div>
          <div style={{ marginTop: -158, fontSize: 48, fontFamily: "'Share Tech Mono', monospace", color: isTimerDone ? "#10B981" : PRIMARY, textShadow: `0 0 16px ${isTimerDone ? "#10B981" : PRIMARY}80`, fontWeight: 700, letterSpacing: "0.1em" }}>{min}:{sec}</div>
          <div className="hud-label" style={{ marginTop: 8, fontSize: 10, letterSpacing: "0.25em", color: isTimerDone ? "#10B981" : activeId ? PRIMARY : "rgba(255,255,255,0.35)" }}>{isTimerDone ? "SESSÃO COMPLETA! ✓" : activeId ? "FOCO ATIVO" : "PRONTA PRA COMEÇAR"}</div>
          {label && activeId && (<div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</div>)}
        </div>

        {/* Controls */}
        {!activeId ? (
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16, maxWidth: 600, margin: "0 auto 16px" }}>
              {FOCUS_MODES.map((m) => (<motion.button key={m.label} whileHover={{ scale: 1.03 }} onClick={() => setDuration(m.duration)} style={{ padding: "12px 10px", textAlign: "center" as const, background: duration === m.duration ? `${PRIMARY}15` : "rgba(255,255,255,0.02)", border: `1px solid ${duration === m.duration ? PRIMARY : "rgba(255,255,255,0.08)"}`, borderRadius: 8, cursor: "pointer" }}><div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div><div className="hud-label" style={{ fontSize: 10, color: duration === m.duration ? PRIMARY : "rgba(255,255,255,0.5)" }}>{m.label}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Share Tech Mono', monospace" }}>{m.desc}</div></motion.button>))}
            </div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="No que vai focar? (opcional)" style={{ width: "100%", maxWidth: 400, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", outline: "none", marginBottom: 16, textAlign: "center" }} />
            <motion.button whileHover={{ scale: 1.03 }} onClick={handleStart} disabled={start.isPending} className="hud-label" style={{ padding: "14px 32px", fontSize: 12, background: `linear-gradient(135deg, ${PRIMARY}25, #7C3AED15)`, border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 8, cursor: "pointer", boxShadow: `0 0 20px ${PRIMARY}25` }}>{start.isPending ? "INICIANDO…" : "▶ INICIAR SESSÃO"}</motion.button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 30 }}>
            <motion.button whileHover={{ scale: 1.03 }} onClick={handleComplete} className="hud-label" style={{ padding: "10px 22px", fontSize: 11, background: "rgba(16,185,129,0.2)", border: "1px solid #10B981", color: "#10B981", borderRadius: 6, cursor: "pointer" }}>✓ COMPLETEI</motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={handleInterrupt} className="hud-label" style={{ padding: "10px 22px", fontSize: 11, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#EF4444", borderRadius: 6, cursor: "pointer" }}>× INTERROMPER</motion.button>
          </div>
        )}

        {/* Weekly chart */}
        {weekly && (
          <section style={{ padding: 18, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 20 }}>
            <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>FOCO DA SEMANA</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 100 }}>
              {weekly.map((d) => {
                const h = maxMin > 0 ? (d.minutes / maxMin) * 100 : 0;
                const date = new Date(d.date + "T12:00:00");
                const dayName = dayNames[date.getDay()] ?? "";
                const isToday = d.date === new Date().toISOString().slice(0, 10);
                return (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 9, color: d.minutes > 0 ? PRIMARY : "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace" }}>{d.minutes > 0 ? `${d.minutes}m` : ""}</span>
                    <div style={{ width: "100%", maxWidth: 40, height: `${Math.max(4, h)}%`, background: d.minutes > 0 ? `linear-gradient(180deg, ${PRIMARY}, ${PRIMARY}80)` : "rgba(255,255,255,0.04)", borderRadius: "4px 4px 0 0" }} />
                    <span style={{ fontSize: 9, fontFamily: "'Share Tech Mono', monospace", color: isToday ? PRIMARY : "rgba(255,255,255,0.3)", fontWeight: isToday ? 700 : 400 }}>{dayName}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Today sessions */}
        {today && today.length > 0 && (
          <section style={{ padding: 18, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 20 }}>
            <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>SESSÕES DE HOJE · {todayCompleted} de {todaySessions}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {today.map((s) => (<div key={s.id} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: `1px solid ${s.completed ? "rgba(16,185,129,0.2)" : s.interruptedAt ? "rgba(239,68,68,0.15)" : `${PRIMARY}20`}`, borderLeft: `3px solid ${s.completed ? "#10B981" : s.interruptedAt ? "#EF4444" : PRIMARY}`, borderRadius: 6, display: "flex", gap: 12, fontSize: 11, fontFamily: "'Share Tech Mono', monospace", alignItems: "center" }}><span style={{ color: "rgba(255,255,255,0.4)", minWidth: 40 }}>{new Date(s.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><span style={{ color: "rgba(255,255,255,0.6)" }}>{s.duration}min</span>{s.actualMinutes !== null && (<span style={{ color: s.completed ? "#10B981" : "#EF4444" }}>{s.completed ? "✓" : "×"} {s.actualMinutes}min</span>)}</div>))}
            </div>
          </section>
        )}

        {/* Study links */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
          {STUDY_LINKS.map((l) => (<Link key={l.to} to={l.to} style={{ textDecoration: "none" }}><motion.div whileHover={{ scale: 1.03 }} style={{ padding: 14, background: "rgba(255,255,255,0.015)", border: `1px solid ${l.color}20`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}><span style={{ fontSize: 18 }}>{l.icon}</span><div><div className="hud-label" style={{ fontSize: 10, color: l.color }}>{l.label}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Estudar com foco</div></div></motion.div></Link>))}
        </section>

        {/* Tips */}
        <section style={{ padding: 16, background: "linear-gradient(135deg, rgba(0,212,255,0.04), transparent)", border: `1px solid ${PRIMARY}15`, borderRadius: 10 }}>
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em", marginBottom: 10 }}>{"\u{1F9E0}"} DICAS DE FOCO</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            {todayMin === 0 && "Comece com uma sessão de 15min. Momentum gera mais momentum."}
            {todayMin > 0 && todayMin < 60 && `${todayMin}min de foco hoje. Tente mais uma sessão curta pra fechar 1h.`}
            {todayMin >= 60 && todayMin < 120 && `${todayMin}min hoje — ritmo sólido! Uma pausa agora pode renovar a energia.`}
            {todayMin >= 120 && `${Math.round(todayMin / 60)}h+ de foco hoje. Na zona! Lembre de hidratar.`}
          </div>
        </section>
      </div>
      <ModuleChat
        module="focus"
        label="FOCO"
        color={PRIMARY}
        welcome="Posso sugerir tecnicas de concentracao, analisar seus padroes de produtividade e otimizar suas sessoes. O que quer melhorar?"
        suggestions={["Tecnica pomodoro", "Dicas de foco", "Analisar minha semana", "Como evitar distracao"]}
      />
    </ModuleShell>
  );
}

function MiniStat(props: { label: string; value: string; color: string }): JSX.Element {
  return (<div style={{ padding: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${props.color}20`, borderRadius: 8, textAlign: "center" }}><div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{props.label}</div><div style={{ fontSize: 18, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: props.color }}>{props.value}</div></div>);
}
