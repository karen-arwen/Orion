import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useJournalToday, useJournalList, useJournalStats,
  useSaveJournal, useGenerateInsight, useJournalInsight,
} from "../../hooks/modules/useJournal.js";

const CYAN   = "#00D4FF";
const GOLD   = "#F59E0B";
const GREEN  = "#10B981";
const PURPLE = "#7C3AED";
const RED    = "#EF4444";
const PINK   = "#EC4899";

/* ── Mood selector ── */
const MOODS = [
  { value: 1, label: "Pessimo",  emoji: "◌", color: RED    },
  { value: 2, label: "Ruim",     emoji: "◎", color: "#F97316" },
  { value: 3, label: "Ok",       emoji: "◈", color: GOLD   },
  { value: 4, label: "Bom",      emoji: "▸", color: GREEN  },
  { value: 5, label: "Excelente",emoji: "✦", color: CYAN   },
];

const ENERGY_LABELS = ["Sem energia", "Pouca energia", "Moderado", "Energizado", "Pleno"];

const PROMPT_STEPS = [
  {
    id: "mood_energy",
    title: "Como voce esta?",
    subtitle: "Humor e energia moldam o tom do dia",
    icon: "◉",
  },
  {
    id: "gratitude",
    title: "3 Gratidoes",
    subtitle: "O que de bom aconteceu ou existe na sua vida?",
    icon: "✦",
  },
  {
    id: "highlight",
    title: "Destaque do Dia",
    subtitle: "O melhor momento ou conquista de hoje",
    icon: "▲",
  },
  {
    id: "challenge",
    title: "Desafio Enfrentado",
    subtitle: "O que foi dificil? O que voce aprendeu?",
    icon: "◧",
  },
  {
    id: "reflection",
    title: "Reflexao Livre",
    subtitle: "O que esta na sua mente? Pensamentos, ideias, sentimentos...",
    icon: "◎",
  },
  {
    id: "intentions",
    title: "Intencoes para Amanha",
    subtitle: "O que voce quer realizar ou ser amanha?",
    icon: "◈",
  },
];

/* ── Mini mood chart (last 14 days SVG) ── */
function MoodChart({ history }: { history: Array<{ date: string; mood: number; energy: number }> }): JSX.Element {
  const recent = [...history].reverse().slice(0, 14);
  if (recent.length === 0) return <></>;

  const W = 320; const H = 80; const pad = 20;
  const xStep = (W - pad * 2) / Math.max(recent.length - 1, 1);
  const yScale = (v: number): number => H - pad - ((v - 1) / 4) * (H - pad * 2);

  const moodPath = recent.map((d, i) => `${i === 0 ? "M" : "L"}${pad + i * xStep},${yScale(d.mood)}`).join(" ");
  const energyPath = recent.map((d, i) => `${i === 0 ? "M" : "L"}${pad + i * xStep},${yScale(d.energy)}`).join(" ");

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map(v => (
        <line key={v} x1={pad} x2={W - pad} y1={yScale(v)} y2={yScale(v)}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {/* Energy line */}
      <path d={energyPath} fill="none" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3" />
      {/* Mood line */}
      <path d={moodPath} fill="none" stroke={CYAN} strokeWidth="2" />
      {/* Mood dots */}
      {recent.map((d, i) => {
        const mood = MOODS.find(m => m.value === d.mood);
        return (
          <circle key={i} cx={pad + i * xStep} cy={yScale(d.mood)} r={3}
            fill={mood?.color ?? CYAN} stroke="#030509" strokeWidth="1.5" />
        );
      })}
      {/* Labels */}
      <text x={pad} y={H} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="'Share Tech Mono', monospace">
        {recent[0]?.date.slice(5) ?? ""}
      </text>
      <text x={W - pad} y={H} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="'Share Tech Mono', monospace">
        {recent[recent.length - 1]?.date.slice(5) ?? ""}
      </text>
    </svg>
  );
}

/* ── Insight Panel ── */
interface InsightPanelProps { date: string; }
function InsightPanel({ date }: InsightPanelProps): JSX.Element {
  const { data: insight, isLoading } = useJournalInsight(date, true);
  const generate = useGenerateInsight();

  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: CYAN, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          ◌ ORION ANALISANDO...
        </motion.div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 12 }}>
          ORION ainda nao analisou este dia
        </div>
        <button
          onClick={() => void generate.mutateAsync(date)}
          disabled={generate.isPending}
          style={{ padding: "10px 20px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
          {generate.isPending ? "◌ GERANDO..." : "✦ ANALISAR COM ORION"}
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Summary */}
      <div style={{ padding: "14px 16px", background: `${PURPLE}08`, border: `1px solid ${PURPLE}20`, borderRadius: 10 }}>
        <div style={{ fontSize: 9, color: PURPLE, fontFamily: "'Share Tech Mono', monospace", marginBottom: 6, letterSpacing: "0.1em" }}>
          ◉ ANALISE ORION
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontFamily: "'Rajdhani', sans-serif" }}>
          {insight.summary}
        </p>
      </div>

      {/* Patterns */}
      {insight.patterns.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8, letterSpacing: "0.08em" }}>
            PADROES DETECTADOS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insight.patterns.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: CYAN, fontSize: 10, flexShrink: 0, marginTop: 2 }}>▸</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.5 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {insight.suggestions.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8, letterSpacing: "0.08em" }}>
            SUGESTOES DO ORION
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insight.suggestions.map((s, i) => (
              <div key={i} style={{ padding: "8px 12px", background: `${CYAN}06`, border: `1px solid ${CYAN}15`, borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.5 }}>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affirmation */}
      <div style={{ padding: "14px 16px", background: `${GOLD}08`, border: `1px solid ${GOLD}25`, borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 9, color: GOLD, fontFamily: "'Share Tech Mono', monospace", marginBottom: 6, letterSpacing: "0.1em" }}>✦ AFIRMACAO</div>
        <p style={{ margin: 0, fontSize: 12, color: GOLD, fontFamily: "'Rajdhani', sans-serif", fontStyle: "italic", lineHeight: 1.6 }}>
          "{insight.affirmation}"
        </p>
      </div>
    </motion.div>
  );
}

/* ── History list item ── */
function HistoryItem({ entry, selected, onClick }: {
  entry: { date: string; mood: number; energy: number; highlight: string; tags: string[] };
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  const mood = MOODS.find(m => m.value === entry.mood);
  return (
    <motion.div
      whileHover={{ x: 3 }}
      onClick={onClick}
      style={{
        padding: "12px 14px",
        background: selected ? `${CYAN}08` : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? CYAN + "30" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 10, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: `${mood?.color ?? CYAN}15`,
        border: `1px solid ${mood?.color ?? CYAN}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, color: mood?.color ?? CYAN,
      }}>
        {mood?.emoji ?? "◈"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>
          {entry.date}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Rajdhani', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.highlight || "Sem destaque"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <div title={`Humor ${entry.mood}`} style={{ width: 6, height: 6, borderRadius: "50%", background: mood?.color ?? CYAN }} />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   GUIDED ENTRY WIZARD
══════════════════════════════════════════════════ */
interface WizardProps {
  initial: Partial<JournalDraft>;
  onSave: (draft: JournalDraft) => void;
  onCancel: () => void;
}

interface JournalDraft {
  mood: number;
  energy: number;
  gratitude: string[];
  highlight: string;
  challenge: string;
  reflection: string;
  intentions: string[];
  tags: string[];
}

function JournalWizard({ initial, onSave, onCancel }: WizardProps): JSX.Element {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<JournalDraft>({
    mood: initial.mood ?? 3,
    energy: initial.energy ?? 3,
    gratitude: initial.gratitude ?? ["", "", ""],
    highlight: initial.highlight ?? "",
    challenge: initial.challenge ?? "",
    reflection: initial.reflection ?? "",
    intentions: initial.intentions ?? ["", ""],
    tags: initial.tags ?? [],
  });
  const [tagInput, setTagInput] = useState("");

  const currentStep = PROMPT_STEPS[step]!;
  const isLast = step === PROMPT_STEPS.length - 1;

  const addTag = (): void => {
    const t = tagInput.trim().toLowerCase();
    if (t && !draft.tags.includes(t)) {
      setDraft(d => ({ ...d, tags: [...d.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string): void => setDraft(d => ({ ...d, tags: d.tags.filter(t => t !== tag) }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(3,5,9,0.94)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ width: "min(540px, 95vw)", background: "rgba(3,5,9,0.98)", border: `1px solid ${CYAN}25`, borderRadius: 16, overflow: "hidden", boxShadow: `0 0 60px ${CYAN}12` }}>

        {/* Progress bar */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.04)" }}>
          <motion.div animate={{ width: `${((step + 1) / PROMPT_STEPS.length) * 100}%` }}
            style={{ height: "100%", background: `linear-gradient(90deg, ${CYAN}, ${PURPLE})` }} />
        </div>

        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>
            {step + 1} / {PROMPT_STEPS.length}
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ padding: "16px 24px 24px", minHeight: 260 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, color: CYAN, marginBottom: 4 }}>{currentStep.icon}</div>
              <div style={{ fontSize: 16, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>
                {currentStep.title}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Rajdhani', sans-serif" }}>
                {currentStep.subtitle}
              </div>
            </div>

            {/* Step 0: Mood + Energy */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 10 }}>HUMOR</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {MOODS.map(m => (
                      <button key={m.value} onClick={() => setDraft(d => ({ ...d, mood: m.value }))}
                        style={{ flex: 1, padding: "12px 6px", background: draft.mood === m.value ? `${m.color}20` : "rgba(255,255,255,0.03)", border: `1.5px solid ${draft.mood === m.value ? m.color + "80" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                        <span style={{ fontSize: 18, color: m.color }}>{m.emoji}</span>
                        <span style={{ fontSize: 8, color: draft.mood === m.value ? m.color : "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>
                    ENERGIA · {ENERGY_LABELS[draft.energy - 1]}
                  </div>
                  <input type="range" min={1} max={5} value={draft.energy} onChange={e => setDraft(d => ({ ...d, energy: Number(e.target.value) }))}
                    style={{ width: "100%", accentColor: GOLD }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    {ENERGY_LABELS.map((l, i) => (
                      <span key={i} style={{ fontSize: 7, color: draft.energy === i + 1 ? GOLD : "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Gratitude */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {draft.gratitude.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: GOLD, fontSize: 12, width: 16, flexShrink: 0 }}>{i + 1}.</span>
                    <input
                      value={g}
                      onChange={e => setDraft(d => { const arr = [...d.gratitude]; arr[i] = e.target.value; return { ...d, gratitude: arr }; })}
                      placeholder={["Algo que voce tem...", "Alguem que voce aprecia...", "Um momento de hoje..."][i] ?? ""}
                      style={{ flex: 1, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Step 2: Highlight */}
            {step === 2 && (
              <textarea
                value={draft.highlight}
                onChange={e => setDraft(d => ({ ...d, highlight: e.target.value }))}
                placeholder="O melhor momento, conquista ou aprendizado de hoje..."
                rows={4}
                style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            )}

            {/* Step 3: Challenge */}
            {step === 3 && (
              <textarea
                value={draft.challenge}
                onChange={e => setDraft(d => ({ ...d, challenge: e.target.value }))}
                placeholder="O que foi dificil hoje? O que voce aprendeu com isso?"
                rows={4}
                style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            )}

            {/* Step 4: Reflection */}
            {step === 4 && (
              <textarea
                value={draft.reflection}
                onChange={e => setDraft(d => ({ ...d, reflection: e.target.value }))}
                placeholder="Pensamentos livres, ideias, o que esta na sua mente..."
                rows={5}
                style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
            )}

            {/* Step 5: Intentions + Tags */}
            {step === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>INTENCOES</div>
                  {draft.intentions.map((intent, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: CYAN, fontSize: 10 }}>◈</span>
                      <input
                        value={intent}
                        onChange={e => setDraft(d => { const arr = [...d.intentions]; arr[i] = e.target.value; return { ...d, intentions: arr }; })}
                        placeholder={`Intencao ${i + 1}...`}
                        style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none" }} />
                    </div>
                  ))}
                  <button onClick={() => setDraft(d => ({ ...d, intentions: [...d.intentions, ""] }))}
                    style={{ fontSize: 9, color: CYAN, background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", padding: 0, marginLeft: 18 }}>
                    + ADICIONAR
                  </button>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>TAGS</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {draft.tags.map(tag => (
                      <span key={tag} style={{ padding: "3px 10px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}30`, borderRadius: 20, fontSize: 10, color: PURPLE, fontFamily: "'Rajdhani', sans-serif", cursor: "pointer" }}
                        onClick={() => removeTag(tag)}>
                        {tag} ×
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()}
                      placeholder="produtividade, saude, trabalho..."
                      style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none" }} />
                    <button onClick={addTag} style={{ padding: "8px 14px", background: `${PURPLE}12`, border: `1px solid ${PURPLE}35`, color: PURPLE, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>+</button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div style={{ padding: "0 24px 24px", display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
              ← VOLTAR
            </button>
          )}
          <button
            onClick={() => isLast ? onSave(draft) : setStep(s => s + 1)}
            style={{ flex: 2, padding: "11px", background: isLast ? `linear-gradient(135deg, ${CYAN}20, ${PURPLE}20)` : `${CYAN}12`, border: `1px solid ${isLast ? CYAN + "50" : CYAN + "30"}`, color: CYAN, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
            {isLast ? "✦ SALVAR ENTRADA" : "PROXIMO →"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
type TabId = "hoje" | "historico" | "insight";

export function JournalPage(): JSX.Element {
  const [tab, setTab] = useState<TabId>("hoje");
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: today, isLoading: loadingToday } = useJournalToday();
  const { data: history = [] } = useJournalList(60);
  const { data: stats } = useJournalStats();
  const saveJournal = useSaveJournal();

  const todayStr = new Date().toISOString().slice(0, 10);

  // Auto-switch to insight tab after save
  const handleSave = async (draft: JournalDraft): Promise<void> => {
    await saveJournal.mutateAsync({ ...draft, date: todayStr });
    setShowWizard(false);
    setTab("insight");
    setSelectedDate(todayStr);
  };

  const viewEntry = history.find(e => e.date === (selectedDate ?? todayStr));

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#030509", color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ color: PINK, fontSize: 18 }}>◎</span>
            <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Share Tech Mono', monospace", color: PINK, letterSpacing: "0.15em", textShadow: `0 0 18px ${PINK}40` }}>
              DIARIO ORION
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>
            {stats ? `${stats.streak} dias · ${stats.totalEntries} entradas · humor medio ${stats.avgMood}` : todayStr}
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          style={{ padding: "10px 20px", background: `${PINK}12`, border: `1px solid ${PINK}40`, color: PINK, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
          {today ? "✎ EDITAR HOJE" : "+ NOVA ENTRADA"}
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "STREAK", value: `${stats.streak}d`, color: GOLD },
            { label: "TOTAL", value: String(stats.totalEntries), color: CYAN },
            { label: "HUMOR MEDIO", value: `${stats.avgMood}/5`, color: GREEN },
            { label: "ENERGIA MEDIA", value: `${stats.avgEnergy}/5`, color: PURPLE },
          ].map(s => (
            <div key={s.label} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontFamily: "'Share Tech Mono', monospace", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mood chart */}
      {stats && stats.moodHistory.length > 2 && (
        <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
            <span>HUMOR (linha azul) · ENERGIA (linha ouro tracejada)</span>
            <span>30 DIAS</span>
          </div>
          <MoodChart history={stats.moodHistory} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {([["hoje", "HOJE"], ["historico", "HISTORICO"], ["insight", "ANALISE ORION"]] as [TabId, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "10px 20px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? PINK : "transparent"}`, color: tab === id ? PINK : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em", transition: "all 0.2s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: HOJE */}
      {tab === "hoje" && (
        <div>
          {loadingToday && <div style={{ color: CYAN, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>◌ CARREGANDO...</div>}

          {!loadingToday && !today && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.25 }}>◎</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 20 }}>
                NENHUMA ENTRADA HOJE
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginBottom: 24, lineHeight: 1.6 }}>
                Registrar seu dia leva apenas 2 minutos.<br />O ORION vai analisar seus padroes e gerar insights.
              </p>
              <button onClick={() => setShowWizard(true)}
                style={{ padding: "12px 28px", background: `${PINK}15`, border: `1px solid ${PINK}40`, color: PINK, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: "0.1em" }}>
                ◎ COMECAR ENTRADA GUIADA
              </button>
            </motion.div>
          )}

          {today && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Mood bar */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {(() => { const m = MOODS.find(x => x.value === today.mood); return (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: `${m?.color ?? CYAN}18`, border: `1px solid ${m?.color ?? CYAN}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: m?.color ?? CYAN }}>
                    {m?.emoji ?? "◈"}
                  </div>
                ); })()}
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.85)" }}>
                    {MOODS.find(m => m.value === today.mood)?.label ?? ""}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>
                    Energia: {ENERGY_LABELS[today.energy - 1]} · {todayStr}
                  </div>
                </div>
              </div>

              {today.gratitude?.filter(Boolean).length > 0 && (
                <div style={{ padding: "14px 16px", background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: GOLD, fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>✦ GRATIDAO</div>
                  {today.gratitude.filter(Boolean).map((g, i) => (
                    <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif", marginBottom: 4 }}>• {g}</div>
                  ))}
                </div>
              )}

              {today.highlight && (
                <div style={{ padding: "14px 16px", background: `${GREEN}08`, border: `1px solid ${GREEN}20`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: GREEN, fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>▲ DESTAQUE</div>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6 }}>{today.highlight}</p>
                </div>
              )}

              {today.challenge && (
                <div style={{ padding: "14px 16px", background: `${RED}06`, border: `1px solid ${RED}18`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: RED, fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>◧ DESAFIO</div>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6 }}>{today.challenge}</p>
                </div>
              )}

              {today.reflection && (
                <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 6 }}>◎ REFLEXAO</div>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6 }}>{today.reflection}</p>
                </div>
              )}

              {today.intentions?.filter(Boolean).length > 0 && (
                <div style={{ padding: "14px 16px", background: `${CYAN}06`, border: `1px solid ${CYAN}18`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: CYAN, fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>◈ INTENCOES PARA AMANHA</div>
                  {today.intentions.filter(Boolean).map((intent, i) => (
                    <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif", marginBottom: 4 }}>→ {intent}</div>
                  ))}
                </div>
              )}

              {today.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {today.tags.map(tag => (
                    <span key={tag} style={{ padding: "3px 10px", background: `${PURPLE}12`, border: `1px solid ${PURPLE}28`, borderRadius: 20, fontSize: 10, color: PURPLE, fontFamily: "'Rajdhani', sans-serif" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <button onClick={() => { setSelectedDate(todayStr); setTab("insight"); }}
                style={{ padding: "12px", background: `${PURPLE}12`, border: `1px solid ${PURPLE}35`, color: PURPLE, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
                ◉ VER ANALISE DO ORION
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Tab: HISTORICO */}
      {tab === "historico" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
            {history.length === 0 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: 40 }}>
                NENHUMA ENTRADA AINDA
              </div>
            )}
            {history.map(entry => (
              <HistoryItem key={entry.date} entry={entry} selected={selectedDate === entry.date}
                onClick={() => setSelectedDate(entry.date)} />
            ))}
          </div>
          <div>
            {viewEntry ? (
              <motion.div key={viewEntry.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: CYAN, fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>{viewEntry.date}</div>
                {viewEntry.highlight && <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6 }}>{viewEntry.highlight}</p>}
                {viewEntry.reflection && <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6 }}>{viewEntry.reflection}</p>}
                <button onClick={() => { setTab("insight"); }}
                  style={{ padding: "8px", background: `${PURPLE}12`, border: `1px solid ${PURPLE}30`, color: PURPLE, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9 }}>
                  VER ANALISE ORION
                </button>
              </motion.div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
                SELECIONE UMA ENTRADA
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: INSIGHT */}
      {tab === "insight" && (
        <div>
          {selectedDate ? (
            <InsightPanel date={selectedDate} />
          ) : today ? (
            <InsightPanel date={todayStr} />
          ) : (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
              ESCREVA UMA ENTRADA PRIMEIRO
            </div>
          )}
        </div>
      )}

      {/* Wizard overlay */}
      <AnimatePresence>
        {showWizard && (
          <JournalWizard
            initial={today ? {
              mood: today.mood, energy: today.energy,
              gratitude: today.gratitude, highlight: today.highlight,
              challenge: today.challenge, reflection: today.reflection,
              intentions: today.intentions, tags: today.tags,
            } : {}}
            onSave={d => { void handleSave(d); }}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
