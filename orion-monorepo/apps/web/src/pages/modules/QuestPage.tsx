import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuestProfile } from "../../hooks/modules/useQuest.js";

const CYAN = "#00D4FF";
const GOLD = "#F59E0B";
const PURPLE = "#7C3AED";
const GREEN = "#10B981";

const RARITY_COLORS: Record<string, string> = {
  common: "#6B7280",
  rare: "#3B82F6",
  epic: "#8B5CF6",
  legendary: "#F59E0B",
};

const RARITY_LABELS: Record<string, string> = {
  common: "COMUM",
  rare: "RARO",
  epic: "ÉPICO",
  legendary: "LENDÁRIO",
};

const LEVEL_HEXAGONS = [
  "RECRUIT", "OPERATIVE", "SPECIALIST", "AGENT",
  "COMMANDER", "DIRECTOR", "ELITE", "LEGEND", "APEX",
];

interface AchievementCardProps {
  ach: {
    id: string; title: string; description: string;
    icon: string; rarity: string; xpReward: number; unlockedAt?: string;
  };
}

function AchievementCard({ ach }: AchievementCardProps): JSX.Element {
  const unlocked = !!ach.unlockedAt;
  const color = RARITY_COLORS[ach.rarity] ?? "#6B7280";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={unlocked ? { scale: 1.03, y: -2 } : {}}
      style={{
        padding: "16px 14px",
        background: unlocked
          ? `linear-gradient(135deg, ${color}12, rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.015)",
        border: `1px solid ${unlocked ? color + "40" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        opacity: unlocked ? 1 : 0.45,
        cursor: "default",
        filter: unlocked ? "none" : "grayscale(1)",
        transition: "all 0.2s ease",
      }}
    >
      {/* Rarity top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: unlocked ? 1 : 0.3 }} />
      <div style={{
        width: 46, height: 46, borderRadius: "50%",
        background: `${color}18`,
        border: `1.5px solid ${color}50`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color,
        boxShadow: unlocked ? `0 0 14px ${color}30` : "none",
      }}>
        {unlocked ? ach.icon : "⬡"}
      </div>
      <div style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.85)", fontWeight: 600, letterSpacing: "0.04em" }}>
        {ach.title}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.4 }}>
        {ach.description}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 8, color, fontFamily: "'Share Tech Mono', monospace", background: `${color}15`, padding: "2px 6px", borderRadius: 4 }}>
          {RARITY_LABELS[ach.rarity] ?? ach.rarity.toUpperCase()}
        </span>
        <span style={{ fontSize: 8, color: GOLD, fontFamily: "'Share Tech Mono', monospace" }}>
          +{ach.xpReward} XP
        </span>
      </div>
      {unlocked && ach.unlockedAt && (
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace" }}>
          {new Date(ach.unlockedAt).toLocaleDateString("pt-BR")}
        </div>
      )}
    </motion.div>
  );
}

interface QuestCardProps {
  quest: {
    id: string; title: string; description: string; icon: string;
    xpReward: number; type: string; progress: number; target: number;
    completed: boolean; expiresAt?: string;
  };
}

function QuestCard({ quest }: QuestCardProps): JSX.Element {
  const pct = Math.round((quest.progress / quest.target) * 100);
  const typeColor = quest.type === "daily" ? CYAN : quest.type === "weekly" ? PURPLE : GOLD;
  const typeLabel = quest.type === "daily" ? "DIÁRIA" : quest.type === "weekly" ? "SEMANAL" : "HISTÓRIA";

  let timeLeft = "";
  if (quest.expiresAt) {
    const diff = new Date(quest.expiresAt).getTime() - Date.now();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    timeLeft = d > 0 ? `${d}d restantes` : h > 0 ? `${h}h restantes` : "expirando";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        padding: "14px 16px",
        background: quest.completed
          ? `linear-gradient(135deg, ${GREEN}08, rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${quest.completed ? GREEN + "30" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: `${typeColor}14`, border: `1px solid ${typeColor}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, color: typeColor,
      }}>
        {quest.completed ? "✓" : quest.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
            {quest.title}
          </span>
          <span style={{ fontSize: 8, color: typeColor, background: `${typeColor}18`, padding: "1px 6px", borderRadius: 4, fontFamily: "'Share Tech Mono', monospace" }}>
            {typeLabel}
          </span>
          {quest.completed && (
            <span style={{ fontSize: 8, color: GREEN, background: `${GREEN}18`, padding: "1px 6px", borderRadius: 4, fontFamily: "'Share Tech Mono', monospace" }}>
              CONCLUÍDA
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Rajdhani', sans-serif", marginBottom: 10 }}>
          {quest.description}
        </div>
        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ height: "100%", background: quest.completed ? GREEN : typeColor, borderRadius: 2 }}
            />
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap" }}>
            {quest.progress}/{quest.target}
          </span>
          <span style={{ fontSize: 9, color: GOLD, fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap" }}>
            +{quest.xpReward} XP
          </span>
        </div>
        {timeLeft && (
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", marginTop: 6 }}>
            ◌ {timeLeft}
          </div>
        )}
      </div>
    </motion.div>
  );
}

type TabKey = "quests" | "achievements" | "log";

export function QuestPage(): JSX.Element {
  const { data, isLoading, error } = useQuestProfile();
  const [tab, setTab] = useState<TabKey>("quests");
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked">("all");

  const profile = data;

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "quests",       label: "MISSÕES",      icon: "◈" },
    { key: "achievements", label: "CONQUISTAS",   icon: "✦" },
    { key: "log",          label: "XP LOG",       icon: "◎" },
  ];

  const filteredAch = (profile?.achievements ?? []).filter(a => {
    if (achFilter === "unlocked") return !!a.unlockedAt;
    if (achFilter === "locked")   return !a.unlockedAt;
    return true;
  });

  return (
    <div style={{
      padding: "28px 32px",
      minHeight: "100vh",
      background: "#030509",
      color: "rgba(255,255,255,0.85)",
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: CYAN, fontSize: 20 }}>◉</span>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Share Tech Mono', monospace", color: CYAN, letterSpacing: "0.15em", textShadow: `0 0 20px ${CYAN}50` }}>
            ORION NEXUS
          </h1>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginLeft: 4 }}>
            / PERFIL & MISSÕES
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'Share Tech Mono', monospace" }}>
          Seu progresso, conquistas e missões ativas no ORION
        </p>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: 80, color: CYAN, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
          ◌ CARREGANDO PERFIL…
        </div>
      )}

      {error && (
        <div style={{ padding: 20, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#EF4444", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
          ✕ Erro ao carregar perfil. Tente novamente.
        </div>
      )}

      {profile && (
        <>
          {/* ═══ PLAYER CARD ═══ */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: `linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,58,237,0.08), rgba(3,5,9,0.9))`,
              border: `1px solid ${CYAN}25`,
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Background grid */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `radial-gradient(circle at 1px 1px, ${CYAN}08 1px, transparent 0)`,
              backgroundSize: "28px 28px",
              pointerEvents: "none",
            }} />

            <div style={{ position: "relative", display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
              {/* Level hexagon */}
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <div style={{
                  width: 90, height: 90, borderRadius: "50%",
                  background: `conic-gradient(${CYAN} ${profile.xpProgress * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 30px ${CYAN}30`,
                  position: "relative",
                }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: "#030509",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 2,
                  }}>
                    <span style={{ fontSize: 26, fontFamily: "'Share Tech Mono', monospace", color: CYAN, lineHeight: 1 }}>
                      {profile.level}
                    </span>
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>
                      NÍV.
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: CYAN, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.12em" }}>
                  {profile.levelName}
                </div>
              </div>

              {/* XP info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>
                    EXPERIÊNCIA TOTAL
                  </span>
                  <span style={{ fontSize: 14, fontFamily: "'Share Tech Mono', monospace", color: GOLD, letterSpacing: "0.06em" }}>
                    {profile.totalXp.toLocaleString("pt-BR")} XP
                  </span>
                </div>
                {/* XP bar */}
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 6, position: "relative" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profile.xpProgress}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background: `linear-gradient(90deg, ${CYAN}, ${PURPLE})`,
                      borderRadius: 4,
                      boxShadow: `0 0 8px ${CYAN}50`,
                    }}
                  />
                  {/* Scan line */}
                  <motion.div
                    animate={{ left: ["0%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.4)", borderRadius: 2 }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>
                  <span>{profile.xpProgress}% para próximo nível</span>
                  {profile.xpToNext > 0 && <span>{profile.xpToNext.toLocaleString("pt-BR")} XP restantes</span>}
                </div>

                {/* Level ladder */}
                <div style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
                  {LEVEL_HEXAGONS.map((lvlName, i) => {
                    const reached = profile.level > i + 1;
                    const current = profile.level === i + 1;
                    return (
                      <div
                        key={lvlName}
                        title={lvlName}
                        style={{
                          width: 22, height: 22, borderRadius: 4,
                          background: reached ? `${CYAN}30` : current ? `${PURPLE}30` : "rgba(255,255,255,0.04)",
                          border: `1px solid ${reached ? CYAN + "60" : current ? PURPLE + "60" : "rgba(255,255,255,0.08)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 7, color: reached ? CYAN : current ? PURPLE : "rgba(255,255,255,0.2)",
                          fontFamily: "'Share Tech Mono', monospace",
                          transition: "all 0.2s ease",
                          boxShadow: current ? `0 0 8px ${PURPLE}50` : "none",
                        }}
                      >
                        {reached ? "✓" : i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
                {[
                  { label: "CONQUISTAS", value: `${(profile.achievements ?? []).filter(a => !!a.unlockedAt).length}/${(profile.achievements ?? []).length}`, color: GOLD },
                  { label: "MISSÕES ATIVAS", value: String((profile.activeQuests ?? []).filter(q => !q.completed).length), color: CYAN },
                  { label: "COMPLETAS HOJE", value: String((profile.activeQuests ?? []).filter(q => q.completed && q.type === "daily").length), color: GREEN },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontFamily: "'Share Tech Mono', monospace", color: s.color, lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ═══ TABS ═══ */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 20px",
                  background: tab === t.key ? `${CYAN}18` : "transparent",
                  border: `1px solid ${tab === t.key ? CYAN + "50" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 8,
                  color: tab === t.key ? CYAN : "rgba(255,255,255,0.4)",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 10,
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* MISSÕES */}
            {tab === "quests" && (
              <motion.div key="quests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {(profile.activeQuests ?? []).length === 0 ? (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
                      ◌ Nenhuma missão ativa — elas serão geradas automaticamente
                    </div>
                  ) : (
                    (profile.activeQuests ?? []).map(q => <QuestCard key={q.id} quest={q} />)
                  )}
                </div>
              </motion.div>
            )}

            {/* CONQUISTAS */}
            {tab === "achievements" && (
              <motion.div key="achievements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Filter */}
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {(["all", "unlocked", "locked"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setAchFilter(f)}
                      style={{
                        padding: "5px 14px",
                        background: achFilter === f ? "rgba(255,255,255,0.06)" : "transparent",
                        border: `1px solid ${achFilter === f ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}`,
                        borderRadius: 6,
                        color: achFilter === f ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 9,
                        cursor: "pointer",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {f === "all" ? `TODAS (${(profile.achievements ?? []).length})` : f === "unlocked" ? `DESBLOQUEADAS (${(profile.achievements ?? []).filter(a => !!a.unlockedAt).length})` : `BLOQUEADAS (${(profile.achievements ?? []).filter(a => !a.unlockedAt).length})`}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {filteredAch.map(a => <AchievementCard key={a.id} ach={a} />)}
                </div>
              </motion.div>
            )}

            {/* XP LOG */}
            {tab === "log" && (
              <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{
                  background: "rgba(255,255,255,0.015)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: GOLD, fontSize: 12 }}>◎</span>
                    <span style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>
                      HISTÓRICO DE XP — ÚLTIMAS {(profile.recentXpLog ?? []).length} ENTRADAS
                    </span>
                  </div>
                  {(profile.recentXpLog ?? []).length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
                      ◌ Nenhum XP registrado ainda — comece completando tarefas!
                    </div>
                  ) : (
                    (profile.recentXpLog ?? []).map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        <span style={{ fontSize: 12, color: GOLD }}>+</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "'Rajdhani', sans-serif" }}>{entry.action}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
                            {new Date(entry.ts).toLocaleString("pt-BR")}
                            {entry.module && <span style={{ marginLeft: 8, color: CYAN }}>· {entry.module}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontFamily: "'Share Tech Mono', monospace", color: GOLD, fontWeight: 700 }}>
                          +{entry.xp}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
