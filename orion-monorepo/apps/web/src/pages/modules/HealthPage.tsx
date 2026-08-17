import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useEnergyHeatmap, useEnergyToday, useLogEnergy } from "../../hooks/modules/useHealth.js";
import { useSleepStats, useSleepRecent, useLogSleep } from "../../hooks/modules/useSleep.js";
import { useHabits } from "../../hooks/modules/useHabits.js";

const PRIMARY = "#10B981";
const COLORS = {
  energy: "#00D4FF", water: "#3B82F6", mood: "#A78BFA",
  steps: "#F59E0B", sleep: "#7C3AED", habits: "#10B981", danger: "#EF4444",
};

const MOOD_OPTIONS = [
  { value: 1, emoji: "\u{1F62B}", label: "Péssimo" },
  { value: 2, emoji: "\u{1F614}", label: "Ruim" },
  { value: 3, emoji: "\u{1F610}", label: "Ok" },
  { value: 4, emoji: "\u{1F60A}", label: "Bom" },
  { value: 5, emoji: "\u{1F604}", label: "Ótimo" },
];

function colorForValue(v: number): string {
  if (v <= 3) return COLORS.danger;
  if (v <= 5) return COLORS.steps;
  if (v <= 7) return COLORS.energy;
  return PRIMARY;
}

function qualityLabel(q: number): string {
  if (q >= 4) return "Ótima"; if (q >= 3) return "Ok"; if (q >= 2) return "Ruim"; return "Péssima";
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? `${m.toString().padStart(2, "0")}m` : ""}`;
}

export function HealthPage(): JSX.Element {
  const [energyValue, setEnergyValue] = useState(7);
  const [energyNote, setEnergyNote] = useState("");
  const [waterCount, setWaterCount] = useState(0);
  const [waterGoal] = useState(8);
  const [mood, setMood] = useState<number | null>(null);
  const [showEnergyLog, setShowEnergyLog] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepQuality, setSleepQuality] = useState(3);
  const [sleepNote, setSleepNote] = useState("");

  const logEnergy = useLogEnergy();
  const { data: today } = useEnergyToday();
  const { data: heatmap } = useEnergyHeatmap();
  const { data: sleepStats } = useSleepStats();
  const { data: sleepRecent } = useSleepRecent();
  const logSleep = useLogSleep();
  const { data: habits } = useHabits();

  const handleLogEnergy = (): void => {
    logEnergy.mutate({ value: energyValue, note: energyNote.trim() || undefined }, { onSuccess: () => setEnergyNote("") });
  };

  const handleLogSleep = (): void => {
    const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const todayStr2 = new Date().toISOString().slice(0, 10);
    const bedDate = parseInt(bedTime.split(":")[0] ?? "23") >= 12 ? yesterdayStr : todayStr2;
    logSleep.mutate({
      bedTime: new Date(`${bedDate}T${bedTime}:00`).toISOString(),
      wakeTime: new Date(`${todayStr2}T${wakeTime}:00`).toISOString(),
      quality: sleepQuality,
      notes: sleepNote.trim() || undefined,
    }, { onSuccess: () => { setShowSleepModal(false); setSleepNote(""); } });
  };

  const todayAvg = today && today.length > 0 ? Math.round((today.reduce((s, e) => s + e.value, 0) / today.length) * 10) / 10 : null;
  const lastSleep = sleepRecent?.[0];
  const lastSleepDuration = lastSleep ? lastSleep.durationMin : null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const habitsDoneToday = (habits ?? []).filter((h) => h.recentLogs[todayStr]).length;
  const habitsTotal = (habits ?? []).length;

  const cellMap = new Map<string, number>();
  for (const c of heatmap?.cells ?? []) { cellMap.set(`${c.date}|${c.hour}`, c.avg); }
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <ModuleShell icon={"♡"} label="SAÚDE" sub="Energia · Corpo · Mente · Sono" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard icon={"⚡"} label="ENERGIA AGORA" value={todayAvg !== null ? `${todayAvg}` : "—"} sub={today && today.length > 0 ? `${today.length} registros hoje` : "Nenhum registro"} color={COLORS.energy} trend={todayAvg !== null ? (todayAvg >= 7 ? "up" : todayAvg <= 4 ? "down" : "neutral") : "neutral"} />
          <StatCard icon={"\u{1F4A7}"} label="HIDRATAÇÃO" value={`${waterCount}/${waterGoal}`} sub="copos de água" color={COLORS.water} trend={waterCount >= waterGoal ? "up" : waterCount >= waterGoal / 2 ? "neutral" : "down"} onClick={() => setWaterCount((c) => Math.min(c + 1, 20))} clickHint="Toque para + 1 copo" />
          <StatCard icon={"☽"} label="ÚLTIMO SONO" value={lastSleepDuration ? formatDuration(lastSleepDuration) : "—"} sub={lastSleep ? `Qualidade: ${qualityLabel(lastSleep.quality)}` : "Nenhum registro"} color={COLORS.sleep} trend={lastSleep ? (lastSleep.quality >= 4 ? "up" : lastSleep.quality <= 2 ? "down" : "neutral") : "neutral"} />
          <StatCard icon={"✓"} label="HÁBITOS HOJE" value={habitsTotal > 0 ? `${habitsDoneToday}/${habitsTotal}` : "—"} sub={habitsTotal > 0 ? `${Math.round((habitsDoneToday / habitsTotal) * 100)}% completo` : "Crie hábitos"} color={COLORS.habits} trend={habitsTotal > 0 && habitsDoneToday === habitsTotal ? "up" : habitsDoneToday > 0 ? "neutral" : "down"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          <section style={{ padding: 20, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.energy}25`, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="hud-label" style={{ fontSize: 10, color: COLORS.energy, letterSpacing: "0.12em" }}>{"⚡"} COMO TÁ A ENERGIA?</div>
              <button onClick={() => setShowEnergyLog((p) => !p)} style={{ padding: "3px 8px", fontSize: 9, background: "transparent", border: `1px solid ${COLORS.energy}30`, color: `${COLORS.energy}99`, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>{showEnergyLog ? "FECHAR" : "VER LOGS"}</button>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (<motion.button key={n} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => setEnergyValue(n)} style={{ flex: 1, height: 38, fontSize: 12, fontFamily: "'Share Tech Mono', monospace", background: energyValue === n ? colorForValue(n) : "rgba(255,255,255,0.03)", border: `1px solid ${energyValue === n ? colorForValue(n) : "rgba(255,255,255,0.08)"}`, color: energyValue === n ? "#fff" : "rgba(255,255,255,0.4)", borderRadius: 6, cursor: "pointer", fontWeight: energyValue === n ? 700 : 400 }}>{n}</motion.button>))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={energyNote} onChange={(e) => setEnergyNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogEnergy()} placeholder="Como se sente?" style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", outline: "none" }} />
              <motion.button whileHover={{ scale: 1.03 }} onClick={handleLogEnergy} disabled={logEnergy.isPending} className="hud-label" style={{ padding: "8px 16px", fontSize: 10, background: `${COLORS.energy}20`, border: `1px solid ${COLORS.energy}`, color: COLORS.energy, borderRadius: 6, cursor: "pointer" }}>{logEnergy.isPending ? "..." : "REGISTRAR"}</motion.button>
            </div>
            <AnimatePresence>
              {showEnergyLog && today && today.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {today.map((p) => (<div key={p.id} style={{ padding: "6px 10px", background: `${colorForValue(p.value)}18`, border: `1px solid ${colorForValue(p.value)}30`, borderRadius: 6, fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.8)" }}><span style={{ color: colorForValue(p.value), fontWeight: 700 }}>{p.value}</span>{" · "}{new Date(p.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{p.note && <span style={{ color: "rgba(255,255,255,0.4)" }}> · {p.note}</span>}</div>))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section style={{ padding: 20, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.mood}25`, borderRadius: 12 }}>
            <div className="hud-label" style={{ fontSize: 10, color: COLORS.mood, letterSpacing: "0.12em", marginBottom: 14 }}>{"\u{1F9E0}"} CHECK-IN RÁPIDO</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Como tá o humor?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {MOOD_OPTIONS.map((m) => (<motion.button key={m.value} whileHover={{ scale: 1.1 }} onClick={() => setMood(m.value)} style={{ flex: 1, padding: "10px 4px", fontSize: 22, textAlign: "center" as const, background: mood === m.value ? `${COLORS.mood}20` : "rgba(255,255,255,0.02)", border: `1px solid ${mood === m.value ? COLORS.mood : "rgba(255,255,255,0.08)"}`, borderRadius: 8, cursor: "pointer" }} title={m.label}>{m.emoji}<div style={{ fontSize: 8, color: mood === m.value ? COLORS.mood : "rgba(255,255,255,0.3)", marginTop: 4 }}>{m.label}</div></motion.button>))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Hidratação · {waterCount} de {waterGoal} copos</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {Array.from({ length: waterGoal }).map((_, i) => (<motion.div key={i} whileHover={{ scale: 1.1 }} onClick={() => setWaterCount(i + 1)} style={{ flex: 1, height: 28, background: i < waterCount ? `${COLORS.water}60` : "rgba(255,255,255,0.03)", border: `1px solid ${i < waterCount ? COLORS.water : "rgba(255,255,255,0.06)"}`, borderRadius: 4, cursor: "pointer", transition: "all 0.2s" }} />))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setWaterCount((c) => Math.max(0, c - 1))} style={{ padding: "4px 10px", fontSize: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>{"−"} 1</button>
                <button onClick={() => setWaterCount((c) => Math.min(20, c + 1))} style={{ padding: "4px 10px", fontSize: 10, background: `${COLORS.water}15`, border: `1px solid ${COLORS.water}40`, color: COLORS.water, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>+ 1 copo</button>
                <button onClick={() => setWaterCount(0)} style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)", borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>RESET</button>
              </div>
            </div>
          </section>
        </div>

        <section style={{ padding: 20, marginBottom: 24, background: "linear-gradient(135deg, rgba(124,58,237,0.06), transparent)", border: `1px solid ${COLORS.sleep}20`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="hud-label" style={{ fontSize: 10, color: COLORS.sleep, letterSpacing: "0.12em" }}>{"☽"} PAINEL DO SONO</div>
            <Link to="/m/sleep" style={{ padding: "4px 10px", fontSize: 9, textDecoration: "none", border: `1px solid ${COLORS.sleep}30`, color: `${COLORS.sleep}aa`, borderRadius: 4, fontFamily: "'Share Tech Mono', monospace" }}>VER COMPLETO {"→"}</Link>
          </div>
          {sleepStats && sleepStats.samplesLast7Days > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              <MiniStat label="MÉDIA" value={formatDuration(sleepStats.avgDurationMin)} color={COLORS.sleep} />
              <MiniStat label="QUALIDADE" value={`${sleepStats.avgQuality}/5`} color={sleepStats.avgQuality >= 3.5 ? PRIMARY : COLORS.danger} />
              <MiniStat label="CONSISTÊNCIA" value={`${sleepStats.consistencyScore}%`} color={sleepStats.consistencyScore >= 70 ? PRIMARY : COLORS.steps} />
              <MiniStat label="REGISTROS" value={`${sleepStats.samplesLast7Days}`} color="rgba(255,255,255,0.5)" />
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, border: "1px dashed rgba(124,58,237,0.2)", borderRadius: 8 }}>Nenhum sono registrado.<Link to="/m/sleep" style={{ display: "block", marginTop: 8, color: COLORS.sleep, fontSize: 11, textDecoration: "none" }}>{"→"} Registrar sono</Link></div>
          )}
        </section>

        <section style={{ padding: 20, marginBottom: 24, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div className="hud-label" style={{ fontSize: 10, color: COLORS.energy, letterSpacing: "0.12em", marginBottom: 4 }}>{"⚡"} MAPA DE ENERGIA</div>
          {heatmap?.lowEnergyHour !== null && heatmap?.lowEnergyHour !== undefined && (
            <div style={{ fontSize: 11, color: COLORS.steps, marginBottom: 12, fontFamily: "'Share Tech Mono', monospace", padding: "6px 10px", background: `${COLORS.steps}08`, border: `1px solid ${COLORS.steps}20`, borderRadius: 6 }}>{"⚠"} Padrão: energia baixa frequente às {heatmap.lowEnergyHour}h</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {days.map((d) => { const date = new Date(d + "T12:00:00"); const dayName = dayNames[date.getDay()] ?? ""; return (<div key={d} style={{ display: "flex", gap: 2, alignItems: "center" }}><span style={{ width: 50, fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>{dayName} {d.slice(8)}</span>{Array.from({ length: 24 }).map((_, h) => { const v = cellMap.get(`${d}|${h}`); return (<div key={h} title={v ? `${d} ${h}h: ${v.toFixed(1)}` : "sem dados"} style={{ flex: 1, height: 20, background: v ? colorForValue(Math.round(v)) : "rgba(255,255,255,0.02)", borderRadius: 2, opacity: v ? 0.85 : 0.4 }} />); })}</div>); })}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
          <QuickLink icon={"☽"} label="SONO" sub="Registrar e acompanhar" to="/m/sleep" color={COLORS.sleep} />
          <QuickLink icon={"✓"} label="HÁBITOS" sub="Streaks e tracking" to="/m/habits" color={COLORS.habits} />
          <QuickLink icon={"◐"} label="FOCO" sub="Sessões de concentração" to="/m/focus" color="#EC4899" />
          <QuickLink icon={"✦"} label="MINDSET" sub="Check-in emocional" to="/m/mindset" color={COLORS.mood} />
        </section>

        <section style={{ padding: 20, background: "linear-gradient(135deg, rgba(16,185,129,0.06), transparent)", border: `1px solid ${PRIMARY}20`, borderRadius: 12 }}>
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em", marginBottom: 14 }}>{"\u{1F9EC}"} INSIGHTS DO ORION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todayAvg !== null && todayAvg <= 4 && (<InsightCard severity="warning" text={`Energia média hoje em ${todayAvg}. Pausa, água ou lanche leve.`} />)}
            {todayAvg !== null && todayAvg >= 8 && (<InsightCard severity="good" text={`Energia em ${todayAvg} hoje — ataque tarefas pesadas!`} />)}
            {sleepStats && sleepStats.consistencyScore < 50 && sleepStats.samplesLast7Days > 0 && (<InsightCard severity="warning" text={`Consistência do sono em ${sleepStats.consistencyScore}%.`} />)}
            {habitsTotal > 0 && habitsDoneToday === habitsTotal && (<InsightCard severity="good" text="Todos os hábitos feitos hoje!" />)}
            {waterCount >= waterGoal && (<InsightCard severity="good" text="Meta de hidratação atingida!" />)}
            {!todayAvg && !lastSleep && habitsTotal === 0 && (<InsightCard severity="neutral" text="Comece registrando energia, sono e hábitos. Com dados, o ORION gera insights." />)}
          </div>
        </section>
      </div>
      {/* Sleep Modal Overlay */}
        <AnimatePresence>
          {showSleepModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSleepModal(false)}
              style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.7)", zIndex: 1000,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 400, padding: 24,
                  background: "linear-gradient(180deg, #0a0f1a, #050810)",
                  border: `1px solid ${COLORS.sleep}40`,
                  borderRadius: 16, boxShadow: `0 0 40px ${COLORS.sleep}20`,
                }}
              >
                <div className="hud-label" style={{ color: COLORS.sleep, fontSize: 12, marginBottom: 20, letterSpacing: "0.15em" }}>
                  REGISTRAR SONO
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>DORMIU</div>
                    <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} className="orion-input" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ACORDOU</div>
                    <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className="orion-input" style={{ width: "100%" }} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>QUALIDADE</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((q) => (
                      <button key={q} onClick={() => setSleepQuality(q)} style={{
                        flex: 1, padding: "8px 4px", fontSize: 18, textAlign: "center",
                        background: sleepQuality === q ? `${COLORS.sleep}25` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${sleepQuality === q ? COLORS.sleep : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 6, cursor: "pointer",
                      }}>
                        {["", "\u{1F62B}", "\u{1F614}", "\u{1F610}", "\u{1F60A}", "\u{1F634}"][q]}
                      </button>
                    ))}
                  </div>
                </div>
                <input value={sleepNote} onChange={(e) => setSleepNote(e.target.value)} placeholder="Nota (opcional)" className="orion-input" style={{ width: "100%", marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleLogSleep} disabled={logSleep.isPending} className="orion-command" style={{ flex: 1, color: COLORS.sleep, borderColor: `${COLORS.sleep}55`, background: `${COLORS.sleep}14` }}>
                    {logSleep.isPending ? "SALVANDO..." : "REGISTRAR"}
                  </button>
                  <button onClick={() => setShowSleepModal(false)} className="orion-command" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)", background: "transparent" }}>
                    CANCELAR
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      <ModuleChat
        module="health"
        label="SAUDE"
        color={PRIMARY}
        welcome="Posso analisar seus padroes de energia, sono e humor, sugerir melhorias e montar rotinas saudaveis. Como posso ajudar?"
        suggestions={["Analise de energia", "Dicas de sono", "Rotina saudavel", "Como melhorar humor"]}
      />
    </ModuleShell>
  );
}

function StatCard(props: { icon: string; label: string; value: string; sub: string; color: string; trend: "up" | "down" | "neutral"; onClick?: () => void; clickHint?: string }): JSX.Element {
  const trendColor = props.trend === "up" ? PRIMARY : props.trend === "down" ? COLORS.danger : "rgba(255,255,255,0.4)";
  const trendIcon = props.trend === "up" ? "↑" : props.trend === "down" ? "↓" : "·";
  return (
    <motion.div whileHover={props.onClick ? { scale: 1.02 } : undefined} onClick={props.onClick} style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${props.color}20`, borderRadius: 10, cursor: props.onClick ? "pointer" : "default", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 16 }}>{props.icon}</span><span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>{props.label}</span></div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 28, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: props.color, textShadow: `0 0 12px ${props.color}40` }}>{props.value}</span><span style={{ fontSize: 14, color: trendColor, fontWeight: 700 }}>{trendIcon}</span></div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{props.sub}</div>
      {props.clickHint && (<div style={{ position: "absolute", top: 8, right: 10, fontSize: 8, color: `${props.color}60`, fontFamily: "'Share Tech Mono', monospace" }}>{props.clickHint}</div>)}
    </motion.div>
  );
}

function MiniStat(props: { label: string; value: string; color: string }): JSX.Element {
  return (<div style={{ padding: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${props.color}20`, borderRadius: 8, textAlign: "center" }}><div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{props.label}</div><div style={{ fontSize: 20, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: props.color }}>{props.value}</div></div>);
}

function QuickLink(props: { icon: string; label: string; sub: string; to: string; color: string }): JSX.Element {
  return (<Link to={props.to} style={{ textDecoration: "none" }}><motion.div whileHover={{ scale: 1.02, borderColor: `${props.color}50` }} style={{ padding: 16, background: "rgba(255,255,255,0.015)", border: `1px solid ${props.color}20`, borderRadius: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}><span style={{ fontSize: 22, color: props.color, filter: `drop-shadow(0 0 6px ${props.color}40)` }}>{props.icon}</span><div><div className="hud-label" style={{ fontSize: 11, color: props.color, letterSpacing: "0.1em" }}>{props.label}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{props.sub}</div></div></motion.div></Link>);
}

function InsightCard(props: { severity: "good" | "warning" | "neutral"; text: string }): JSX.Element {
  const colorMap = { good: PRIMARY, warning: COLORS.steps, neutral: "rgba(255,255,255,0.4)" };
  const iconMap = { good: "✓", warning: "⚠", neutral: "◎" };
  const c = colorMap[props.severity];
  return (<div style={{ padding: "10px 14px", background: `${c}08`, border: `1px solid ${c}25`, borderRadius: 8, display: "flex", gap: 10, alignItems: "flex-start" }}><span style={{ color: c, fontSize: 14, lineHeight: 1 }}>{iconMap[props.severity]}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{props.text}</span></div>);
}
