import { useState } from "react";
import type { LanguageLevel, LanguageMode } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useLanguagePractice } from "../../hooks/modules/useLanguage.js";
import { TagPill } from "../../components/visual/TagPill.js";
import { RingGauge } from "../../components/visual/RingGauge.js";

const PRIMARY = "#10B981";
const ACCENT = "#00D4FF";
const WARN = "#F59E0B";
const PURPLE = "#7C3AED";

/* ═══════════════════════════════════════════════════════════════════
   LANGUAGE — pratica de idioma com IA + feedback estruturado.

   Refeito: hero com idioma destacado + level/mode chips, area de prompt
   com diff visual entre input e corrected, painel de notas e drills com
   marca registrada de qual tipo de drill (gramatica, pronuncia, etc).
═══════════════════════════════════════════════════════════════════ */

const LEVEL_OPTIONS: Array<{ value: LanguageLevel; label: string; pct: number }> = [
  { value: "iniciante", label: "INICIANTE", pct: 33 },
  { value: "intermediario", label: "INTERMEDIARIO", pct: 66 },
  { value: "avancado", label: "AVANCADO", pct: 100 },
];

const MODE_OPTIONS: Array<{ value: LanguageMode; label: string; icon: string; color: string }> = [
  { value: "chat", label: "CONVERSA", icon: "◈", color: PRIMARY },
  { value: "entrevista", label: "ENTREVISTA", icon: "▲", color: WARN },
  { value: "viagem", label: "VIAGEM", icon: "◁", color: ACCENT },
  { value: "gramatica", label: "GRAMATICA", icon: "◉", color: PURPLE },
  { value: "pronuncia", label: "PRONUNCIA", icon: "◎", color: "#EC4899" },
];

const LANGUAGE_PRESETS = ["English", "Espanol", "Italiano", "Frances", "Alemao", "Japones", "Coreano", "Mandarim", "Portugues"];

export function LanguagePage(): JSX.Element {
  const practice = useLanguagePractice();
  const [language, setLanguage] = useState("English");
  const [level, setLevel] = useState<LanguageLevel>("intermediario");
  const [mode, setMode] = useState<LanguageMode>("chat");
  const [message, setMessage] = useState("");

  const run = (): void => {
    if (!message.trim()) return;
    practice.mutate({ language, level, mode, message }, { onSuccess: () => { setChatHistory((prev) => [{ q: message, response: '...', timestamp: new Date().toISOString() }, ...prev]); } });
  };

  const [chatHistory, setChatHistory] = useState<Array<{q: string; response: string; timestamp: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customLang, setCustomLang] = useState("");

  const CONTENT_SUGGESTIONS: Record<string, Array<{type: string; title: string; link: string}>> = {
    English: [
      { type: "\u{1F3AC} Filme", title: "Assista filmes com legenda em inglês", link: "#" },
      { type: "\u{1F3B5} Música", title: "Ouça músicas e tente traduzir a letra", link: "#" },
      { type: "\u{1F4FA} YouTube", title: "Canais: English with Lucy, Rachel's English", link: "#" },
      { type: "\u{1F3AE} Jogo", title: "Jogue games em inglês (RPGs são ótimos)", link: "#" },
    ],
    Coreano: [
      { type: "\u{1F3AC} Doramas", title: "Assista K-dramas com legenda coreana", link: "#" },
      { type: "\u{1F3B5} K-pop", title: "Traduza letras dos seus grupos favoritos", link: "#" },
      { type: "\u{1F4FA} YouTube", title: "Canais: Talk To Me In Korean, KoreanClass101", link: "#" },
      { type: "\u{1F4D6} App", title: "Duolingo Korean + Anki flashcards", link: "#" },
    ],
    Japones: [
      { type: "\u{1F3AC} Anime", title: "Assista animes sem legenda (try!)", link: "#" },
      { type: "\u{1F3B5} Música", title: "J-pop/J-rock com letra", link: "#" },
      { type: "\u{1F4FA} YouTube", title: "Canais: JapanesePod101, Miku Real Japanese", link: "#" },
      { type: "\u{1F3AE} Jogo", title: "Visual novels em japonês", link: "#" },
    ],
  };

  const currentLevel = LEVEL_OPTIONS.find((l) => l.value === level) ?? LEVEL_OPTIONS[1]!;
  const currentMode = MODE_OPTIONS.find((m) => m.value === mode) ?? MODE_OPTIONS[0]!;

  return (
    <ModuleShell icon="◷" label="IDIOMAS" sub="Pratica · correcao · drills personalizados" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ━━━ HERO ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                IDIOMA EM PRATICA
              </span>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 30,
                  color: PRIMARY,
                  letterSpacing: "0.1em",
                  textShadow: `0 0 12px ${PRIMARY}66`,
                  width: "100%",
                  padding: "4px 0",
                  borderBottom: `1px dashed ${PRIMARY}33`,
                }}
              />
              <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                {LANGUAGE_PRESETS.map((l) => (
                  <TagPill
                    key={l}
                    label={l}
                    color={ACCENT}
                    variant={language === l ? "solid" : "outline"}
                    active={language === l}
                    onClick={() => setLanguage(l)}
                    size="xs"
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <TagPill label={currentLevel.label} color={PRIMARY} variant="solid" size="md" />
                <TagPill icon={currentMode.icon} label={currentMode.label} color={currentMode.color} variant="solid" size="md" />
              </div>
            </div>
            <RingGauge
              value={currentLevel.pct}
              centerLabel={currentLevel.pct === 33 ? "A2" : currentLevel.pct === 66 ? "B1" : "C1"}
              topLabel="NIVEL"
              bottomLabel={currentLevel.label}
              color={PRIMARY}
              size={110}
            />
          </div>
        </section>

        {/* ━━━ CONFIG ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14, letterSpacing: "0.22em" }}>
            CONFIGURACAO DA SESSAO
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>NIVEL</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {LEVEL_OPTIONS.map((l) => (
                  <TagPill
                    key={l.value}
                    label={l.label}
                    color={PRIMARY}
                    variant={level === l.value ? "solid" : "outline"}
                    active={level === l.value}
                    onClick={() => setLevel(l.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>MODO</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {MODE_OPTIONS.map((m) => (
                  <TagPill
                    key={m.value}
                    icon={m.icon}
                    label={m.label}
                    color={m.color}
                    variant={mode === m.value ? "solid" : "outline"}
                    active={mode === m.value}
                    onClick={() => setMode(m.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="hud-divider" />

          <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>
            SUA MENSAGEM ({language})
          </div>
          <textarea
            className="orion-input"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Escreva algo em ${language} pra praticar. Ex: "I want to discuss my career goals with my manager next week."`}
            style={{ resize: "vertical", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.6 }}
          />
          <button
            onClick={run}
            disabled={practice.isPending || !message.trim()}
            className="orion-command"
            style={{
              color: PRIMARY,
              borderColor: `${PRIMARY}77`,
              background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
              marginTop: 12,
              fontSize: 11,
              padding: "12px 18px",
              boxShadow: `0 0 12px ${PRIMARY}33`,
              opacity: !message.trim() ? 0.4 : 1,
            }}
          >
            {practice.isPending ? "◌ ANALISANDO..." : "▷ PRATICAR"}
          </button>
        </section>

        {/* ━━━ RESULTADO ━━━ */}
        {practice.data && (
          <>
            {/* Reply do tutor */}
            <section className="dash-section" style={{ animation: "fadeUp 0.5s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16, color: PRIMARY, textShadow: `0 0 8px ${PRIMARY}` }}>◈</span>
                <span className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.22em" }}>RESPOSTA DO TUTOR</span>
              </div>
              <div style={{
                padding: "12px 14px",
                background: `linear-gradient(135deg, ${PRIMARY}10, transparent)`,
                borderRadius: 8,
                borderLeft: `3px solid ${PRIMARY}`,
                fontSize: 13.5,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                fontFamily: "'Rajdhani', sans-serif",
              }}>
                {practice.data.reply}
              </div>
            </section>

            {/* Diff: original vs corrigida */}
            <section className="dash-section" style={{ animation: "fadeUp 0.5s ease 0.05s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16, color: WARN, textShadow: `0 0 8px ${WARN}` }}>⇄</span>
                <span className="hud-label" style={{ color: WARN, fontSize: 10, letterSpacing: "0.22em" }}>CORRECAO E REESCRITA</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                <DiffBlock label="VOCE ESCREVEU" text={message} color="rgba(255,255,255,0.5)" />
                <DiffBlock label="VERSAO POLIDA" text={practice.data.corrected} color={WARN} />
              </div>
            </section>

            {/* Notas + Drills */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {practice.data.notes.length > 0 && (
                <section className="dash-section" style={{ borderColor: `${PURPLE}33` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: PURPLE }}>◉</span>
                    <span className="hud-label" style={{ color: PURPLE, fontSize: 10, letterSpacing: "0.22em" }}>
                      NOTAS DE ESTUDO
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }} className="hud-stagger">
                    {practice.data.notes.map((note, i) => (
                      <li key={`${note}-${i}`} style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.72)",
                        lineHeight: 1.55,
                        paddingLeft: 22,
                        position: "relative",
                      }}>
                        <span style={{
                          position: "absolute",
                          left: 0,
                          top: 1,
                          fontFamily: "'Share Tech Mono', monospace",
                          color: PURPLE,
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {practice.data.drills.length > 0 && (
                <section className="dash-section" style={{ borderColor: `${ACCENT}33` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: ACCENT }}>▲</span>
                    <span className="hud-label" style={{ color: ACCENT, fontSize: 10, letterSpacing: "0.22em" }}>
                      DRILLS PRA HOJE
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="hud-stagger">
                    {practice.data.drills.map((drill, i) => (
                      <div key={`${drill}-${i}`} style={{
                        padding: "9px 12px",
                        borderRadius: 7,
                        border: `1px solid ${ACCENT}22`,
                        background: `${ACCENT}08`,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}>
                        <span style={{
                          fontSize: 10,
                          color: ACCENT,
                          fontFamily: "'Share Tech Mono', monospace",
                          padding: "2px 6px",
                          background: `${ACCENT}18`,
                          borderRadius: 3,
                          minWidth: 32,
                          textAlign: "center",
                          fontWeight: 700,
                        }}>
                          D{i + 1}
                        </span>
                        <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.55, flex: 1 }}>
                          {drill}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      
        {/* Content Suggestions */}
        <section style={{ marginTop: 20, padding: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.05), transparent)", border: `1px solid ${PRIMARY}18`, borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em" }}>{"\u{1F4DA}"} APRENDA COM O QUE GOSTA</div>
            <button onClick={() => setShowSuggestions((p) => !p)} style={{ padding: "3px 8px", fontSize: 9, background: "transparent", border: `1px solid ${PRIMARY}30`, color: `${PRIMARY}99`, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>{showSuggestions ? "FECHAR" : "VER DICAS"}</button>
          </div>
          {showSuggestions && (CONTENT_SUGGESTIONS[language] ?? CONTENT_SUGGESTIONS.English ?? []).map((s) => (
            <div key={s.title} style={{ padding: "8px 12px", marginBottom: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${PRIMARY}12`, borderRadius: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              <span style={{ color: PRIMARY, marginRight: 8 }}>{s.type}</span>{s.title}
            </div>
          ))}
          {!showSuggestions && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Filmes, músicas, jogos, YouTube — aprenda no seu ritmo.</div>}
        </section>

        {/* Chat History / Notebook */}
        {chatHistory.length > 0 && (
          <section style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
            <div className="hud-label" style={{ fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>{"\u{1F4D3}"} NOTEBOOK DO DIA · {chatHistory.length} interações</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {chatHistory.slice(0, 10).map((entry, i) => (
                <div key={i} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${ACCENT}12`, borderRadius: 6, fontSize: 11 }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{entry.q}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>{new Date(entry.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          </section>
        )}

</div>
      <ModuleChat
        module="language"
        label="IDIOMAS"
        color={PRIMARY}
        welcome="Posso praticar idiomas, corrigir texto, criar exercicios e montar planos de estudo. Em qual idioma quer praticar?"
        suggestions={["Praticar conversacao", "Corrigir meu texto", "Plano de estudo", "Dicas de pronuncia"]}
      />
    </ModuleShell>
  );
}

function DiffBlock({ label, text, color }: { label: string; text: string; color: string }): JSX.Element {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      border: `1px solid ${color}22`,
      background: "rgba(255,255,255,0.015)",
    }}>
      <span className="hud-label" style={{ color, fontSize: 8, letterSpacing: "0.22em", marginBottom: 6, display: "block" }}>
        {label}
      </span>
      <div style={{
        fontSize: 13,
        color: "rgba(255,255,255,0.78)",
        lineHeight: 1.55,
        fontFamily: "'Rajdhani', sans-serif",
        whiteSpace: "pre-wrap",
      }}>
        {text}
      </div>
    </div>
  );
}
