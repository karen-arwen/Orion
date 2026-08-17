import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useCreateHabit,
  useDeleteHabit,
  useHabits,
  useToggleHabit,
} from "../../hooks/modules/useHabits.js";

const PRIMARY = "#10B981";
const COLOR_OPTIONS = ["#00D4FF", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#3B82F6", "#8B5CF6"];
const ICON_OPTIONS = ["✓", "♡", "◉", "◐", "☽", "✦", "▷", "↑", "\u{1F4A7}", "\u{1F3C3}", "\u{1F4D6}", "\u{1F9D8}", "\u{1F4AA}", "\u{1F3AF}", "\u{1F9E0}", "\u{1F3B5}"];

const SUGGESTIONS = [
  { name: "Meditar 10 min", icon: "\u{1F9D8}", color: "#7C3AED" },
  { name: "Beber 8 copos de água", icon: "\u{1F4A7}", color: "#3B82F6" },
  { name: "Ler 20 páginas", icon: "\u{1F4D6}", color: "#F59E0B" },
  { name: "Exercício 30 min", icon: "\u{1F3C3}", color: "#EF4444" },
  { name: "Escrever 3 gratidões", icon: "✦", color: "#EC4899" },
  { name: "Estudar idioma 15 min", icon: "\u{1F3AF}", color: "#00D4FF" },
  { name: "Sem redes sociais 1h", icon: "◐", color: "#8B5CF6" },
  { name: "Alongamento 10 min", icon: "\u{1F4AA}", color: "#10B981" },
];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function HabitsPage(): JSX.Element {
  const { data: habits, isLoading } = useHabits();
  const create = useCreateHabit();
  const toggle = useToggleHabit();
  const remove = useDeleteHabit();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#00D4FF");
  const [newIcon, setNewIcon] = useState("✓");
  const [celebrateId, setCelebrateId] = useState<string | null>(null);

  const handleCreate = (): void => {
    if (!newName.trim()) return;
    create.mutate({ name: newName.trim(), color: newColor, icon: newIcon }, { onSuccess: () => { setNewName(""); setShowForm(false); } });
  };

  const handleToggle = (id: string): void => {
    const habit = habits?.find((h) => h.id === id);
    const todayStr = isoDaysAgo(0);
    const wasDone = habit?.recentLogs[todayStr] ?? false;
    if (!wasDone) { setCelebrateId(id); setTimeout(() => setCelebrateId(null), 1500); }
    toggle.mutate(id);
  };

  const handleSuggestion = (s: typeof SUGGESTIONS[number]): void => {
    create.mutate({ name: s.name, color: s.color, icon: s.icon });
  };

  const todayStr = isoDaysAgo(0);
  const totalHabits = habits?.length ?? 0;
  const doneToday = (habits ?? []).filter((h) => h.recentLogs[todayStr]).length;
  const completionPct = totalHabits > 0 ? Math.round((doneToday / totalHabits) * 100) : 0;
  const bestStreak = Math.max(0, ...(habits ?? []).map((h) => h.bestStreak));
  const currentStreaks = (habits ?? []).filter((h) => h.streak > 0).length;

  const dayGrid: string[] = [];
  for (let i = 29; i >= 0; i--) dayGrid.push(isoDaysAgo(i));

  return (
    <ModuleShell icon="✓" label="HÁBITOS" sub="Streak · Tracking · Coach" color={PRIMARY}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          <HeroStat label="HOJE" value={totalHabits > 0 ? `${doneToday}/${totalHabits}` : "—"} sub={totalHabits > 0 ? `${completionPct}%` : "Crie hábitos"} color={completionPct === 100 ? PRIMARY : completionPct > 0 ? "#00D4FF" : "rgba(255,255,255,0.3)"} />
          <HeroStat label="STREAKS ATIVAS" value={`${currentStreaks}`} sub="hábitos consecutivos" color={currentStreaks > 0 ? "#F59E0B" : "rgba(255,255,255,0.3)"} />
          <HeroStat label="RECORDE" value={`${bestStreak}d`} sub="melhor streak" color={bestStreak >= 7 ? PRIMARY : "#7C3AED"} />
          <HeroStat label="TOTAL" value={`${totalHabits}`} sub="hábitos ativos" color="#00D4FF" />
        </div>

        {/* Progress bar */}
        {totalHabits > 0 && (
          <div style={{ marginBottom: 24, padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: `1px solid ${completionPct === 100 ? PRIMARY : "rgba(255,255,255,0.08)"}30`, borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Progresso do dia</span>
              <span style={{ fontSize: 12, fontFamily: "'Share Tech Mono', monospace", color: completionPct === 100 ? PRIMARY : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{completionPct}%{completionPct === 100 && " ✓ COMPLETO"}</span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${completionPct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ height: "100%", background: completionPct === 100 ? `linear-gradient(90deg, ${PRIMARY}, #00D4FF)` : `linear-gradient(90deg, ${PRIMARY}cc, ${PRIMARY})`, borderRadius: 99, boxShadow: `0 0 12px ${PRIMARY}40` }} />
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowForm((p) => !p)} className="hud-label" style={{ padding: "8px 16px", fontSize: 10, background: showForm ? `${PRIMARY}25` : "rgba(255,255,255,0.03)", border: `1px solid ${showForm ? PRIMARY : "rgba(255,255,255,0.12)"}`, color: showForm ? PRIMARY : "rgba(255,255,255,0.5)", borderRadius: 6, cursor: "pointer" }}>{showForm ? "× FECHAR" : "+ NOVO HÁBITO"}</motion.button>
        </div>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: 18, background: "rgba(255,255,255,0.02)", border: `1px solid ${PRIMARY}30`, borderRadius: 10 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Nome do hábito (ex: 'meditar 10min', 'ler 20 páginas')" style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 13, fontFamily: "'Rajdhani', sans-serif", outline: "none", marginBottom: 14 }} />
                <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                  <div>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>COR</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {COLOR_OPTIONS.map((c) => (<button key={c} onClick={() => setNewColor(c)} style={{ width: 26, height: 26, background: c, border: newColor === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.1)", borderRadius: 4, cursor: "pointer", boxShadow: newColor === c ? `0 0 8px ${c}60` : "none" }} />))}
                    </div>
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>ÍCONE</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 280 }}>
                      {ICON_OPTIONS.map((i) => (<button key={i} onClick={() => setNewIcon(i)} style={{ width: 28, height: 28, fontSize: 14, background: newIcon === i ? `${newColor}30` : "rgba(255,255,255,0.04)", border: `1px solid ${newIcon === i ? newColor : "rgba(255,255,255,0.1)"}`, color: newIcon === i ? newColor : "rgba(255,255,255,0.5)", borderRadius: 4, cursor: "pointer" }}>{i}</button>))}
                    </div>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.03 }} onClick={handleCreate} disabled={!newName.trim() || create.isPending} className="hud-label" style={{ padding: "8px 18px", fontSize: 10, background: `${newColor}25`, border: `1px solid ${newColor}`, color: newColor, borderRadius: 6, cursor: newName.trim() ? "pointer" : "not-allowed", opacity: newName.trim() ? 1 : 0.4 }}>{create.isPending ? "CRIANDO…" : "+ CRIAR HÁBITO"}</motion.button>

                {/* Sugestoes */}
                <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 14 }}>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>SUGESTÕES RÁPIDAS</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {SUGGESTIONS.filter((s) => !(habits ?? []).some((h) => h.name === s.name)).map((s) => (<motion.button key={s.name} whileHover={{ scale: 1.03 }} onClick={() => handleSuggestion(s)} style={{ padding: "6px 12px", fontSize: 11, background: `${s.color}10`, border: `1px solid ${s.color}30`, color: s.color, borderRadius: 6, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif" }}>{s.icon} {s.name}</motion.button>))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && (<div className="hud-label" style={{ color: "rgba(255,255,255,0.3)", padding: 40, textAlign: "center" }}>◌ carregando hábitos…</div>)}

        {habits && habits.length === 0 && !isLoading && (
          <div style={{ padding: 40, background: "rgba(255,255,255,0.015)", border: `1px dashed ${PRIMARY}30`, borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{"\u{1F3AF}"}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Nenhum hábito ainda</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>Comece com algo pequeno — meditar 5min, beber mais água, ler antes de dormir. Consistência vence intensidade.</div>
            <button onClick={() => setShowForm(true)} className="hud-label" style={{ padding: "10px 20px", fontSize: 11, background: `${PRIMARY}20`, border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 6, cursor: "pointer" }}>+ CRIAR PRIMEIRO HÁBITO</button>
          </div>
        )}

        {/* Habit List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(habits ?? []).map((h) => {
            const doneToday = h.recentLogs[todayStr] ?? false;
            const isCelebrating = celebrateId === h.id;
            return (
              <motion.div key={h.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, borderColor: isCelebrating ? h.color : `${h.color}30`, boxShadow: isCelebrating ? `0 0 20px ${h.color}40` : "none" }} style={{ padding: 16, background: doneToday ? `${h.color}06` : "rgba(255,255,255,0.02)", border: `1px solid ${h.color}30`, borderLeft: `4px solid ${doneToday ? h.color : `${h.color}60`}`, borderRadius: 10, position: "relative", overflow: "hidden" }}>
                <AnimatePresence>
                  {isCelebrating && (<motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} style={{ position: "absolute", inset: 0, background: `${h.color}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, zIndex: 10 }}>{"\u{1F389}"}</motion.div>)}
                </AnimatePresence>

                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.85 }} onClick={() => handleToggle(h.id)} disabled={toggle.isPending} style={{ width: 44, height: 44, fontSize: 20, background: doneToday ? `${h.color}25` : "rgba(255,255,255,0.04)", border: `2px solid ${doneToday ? h.color : "rgba(255,255,255,0.15)"}`, borderRadius: 10, cursor: "pointer", color: doneToday ? h.color : "rgba(255,255,255,0.5)", boxShadow: doneToday ? `0 0 10px ${h.color}30` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{doneToday ? "✓" : h.icon}</motion.button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{h.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Share Tech Mono', monospace", display: "flex", gap: 8, marginTop: 3 }}>
                      <span style={{ color: h.streak > 0 ? "#F59E0B" : "inherit" }}>{"\u{1F525}"} {h.streak}d streak</span>
                      <span>· recorde {h.bestStreak}d</span>
                    </div>
                  </div>
                  <button onClick={() => { if (confirm(`Apagar "${h.name}"?`)) remove.mutate(h.id); }} style={{ padding: "4px 8px", fontSize: 12, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.5)", borderRadius: 4, cursor: "pointer" }}>×</button>
                </div>

                {/* Heatmap 30 dias */}
                <div style={{ display: "flex", gap: 2 }}>
                  {dayGrid.map((d) => { const done = h.recentLogs[d] ?? false; return (<div key={d} title={`${d}${done ? " · feito ✓" : ""}`} style={{ flex: 1, height: 14, background: done ? h.color : "rgba(255,255,255,0.04)", borderRadius: 2, opacity: done ? 0.85 : 0.4, transition: "all 0.2s" }} />); })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", marginTop: 3 }}><span>30d atrás</span><span>hoje</span></div>
              </motion.div>
            );
          })}
        </div>

        {/* Coach Tips */}
        {habits && habits.length > 0 && (
          <section style={{ marginTop: 24, padding: 18, background: "linear-gradient(135deg, rgba(16,185,129,0.06), transparent)", border: `1px solid ${PRIMARY}20`, borderRadius: 12 }}>
            <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em", marginBottom: 10 }}>{"\u{1F9E0}"} COACH DO ORION</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completionPct === 100 && (<CoachTip text={"Dia perfeito! Todos os hábitos feitos. Essa consistência constrói resultados reais. \u{1F389}"} color={PRIMARY} />)}
              {completionPct > 0 && completionPct < 100 && (<CoachTip text={`Faltam ${totalHabits - doneToday} hábito(s) hoje. Não precisa ser perfeito, mas não quebre a cadeia.`} color="#F59E0B" />)}
              {habits.some((h) => h.streak >= 7) && (<CoachTip text="Tem streak de +7 dias! Hábitos com 7+ dias começam a ficar automáticos." color="#7C3AED" />)}
              {habits.some((h) => h.streak === 0 && h.bestStreak > 3) && (<CoachTip text="Algum hábito quebrou a streak. Normal. O segredo é voltar imediatamente." color="#EF4444" />)}
            </div>
          </section>
        )}
      </div>
      <ModuleChat
        module="habits"
        label="HABITOS"
        color={PRIMARY}
        welcome="Posso sugerir novos habitos, analisar suas streaks, identificar padroes e ajudar a manter consistencia. O que precisa?"
        suggestions={["Sugerir habitos", "Analisar streaks", "Como nao quebrar", "Habito de estudo"]}
      />
    </ModuleShell>
  );
}

function HeroStat(props: { label: string; value: string; sub: string; color: string }): JSX.Element {
  return (
    <div style={{ padding: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${props.color}20`, borderRadius: 10, textAlign: "center" }}>
      <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{props.label}</div>
      <div style={{ fontSize: 26, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: props.color, textShadow: `0 0 10px ${props.color}30` }}>{props.value}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{props.sub}</div>
    </div>
  );
}

function CoachTip(props: { text: string; color: string }): JSX.Element {
  return (<div style={{ padding: "8px 12px", background: `${props.color}08`, border: `1px solid ${props.color}20`, borderRadius: 6, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{props.text}</div>);
}
