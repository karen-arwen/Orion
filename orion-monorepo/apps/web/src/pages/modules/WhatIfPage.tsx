import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useWhatIfScenario } from "../../hooks/modules/useWhatIf.js";
import { RingGauge } from "../../components/visual/RingGauge.js";
import { TagPill } from "../../components/visual/TagPill.js";

const PRIMARY = "#00D4FF";
const SUCCESS = "#10B981";
const DANGER = "#EF4444";
const WARN = "#F59E0B";
const PURPLE = "#7C3AED";

/* ═══════════════════════════════════════════════════════════════════
   WHAT-IF — simulador de cenarios estrategicos.

   Refeito: hero com pergunta como prompt grande, horizon como ring de
   tempo, 3 outcome cards lado a lado (provavel ciano / melhor verde /
   pior vermelho), decision matrix como cards com effort + confidence
   gauge visual, leading indicators e next actions em painel grid.
═══════════════════════════════════════════════════════════════════ */

const HORIZON_OPTIONS = [
  { value: "7d", label: "7 DIAS", pct: 15 },
  { value: "30d", label: "30 DIAS", pct: 40 },
  { value: "90d", label: "90 DIAS", pct: 70 },
  { value: "1y", label: "1 ANO", pct: 100 },
] as const;

const EFFORT_META: Record<"baixo" | "medio" | "alto", { label: string; color: string; pct: number }> = {
  baixo: { label: "BAIXO", color: SUCCESS, pct: 33 },
  medio: { label: "MEDIO", color: WARN, pct: 66 },
  alto: { label: "ALTO", color: DANGER, pct: 100 },
};

export function WhatIfPage(): JSX.Element {
  const scenario = useWhatIfScenario();
  const [question, setQuestion] = useState("E se eu focar os proximos 90 dias em transformar o Orion em produto real?");
  const [horizon, setHorizon] = useState<"7d" | "30d" | "90d" | "1y">("90d");
  const [constraints, setConstraints] = useState("");

  const currentHorizon = HORIZON_OPTIONS.find((h) => h.value === horizon) ?? HORIZON_OPTIONS[2]!;

  const run = (): void => {
    if (!question.trim()) return;
    scenario.mutate({ question, horizon, constraints: constraints.trim() || undefined });
  };

  return (
    <ModuleShell icon="◮" label="WHAT-IF" sub="Simulador estrategico · cenarios · decisao" color={PRIMARY}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ━━━ HERO ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                DECISION SIMULATOR
              </span>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, maxWidth: 520, lineHeight: 1.5 }}>
                Formule a pergunta como uma hipotese. O Orion roda cenarios, mapeia opcoes e te entrega upside/downside com nivel de confianca.
              </p>
            </div>
            <RingGauge
              value={currentHorizon.pct}
              centerLabel={currentHorizon.label.replace(" DIAS", "d").replace(" ANO", "y")}
              topLabel="HORIZONTE"
              bottomLabel={currentHorizon.label}
              color={PURPLE}
              size={110}
            />
          </div>
        </section>

        {/* ━━━ PROMPT ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 12, letterSpacing: "0.22em" }}>
            HIPOTESE
          </div>
          <textarea
            className="orion-input"
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: E se eu trocar de emprego nos proximos 30 dias?"
            style={{
              resize: "vertical",
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: "'Rajdhani', sans-serif",
            }}
          />

          <div className="hud-divider" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>HORIZONTE</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {HORIZON_OPTIONS.map((h) => (
                  <TagPill
                    key={h.value}
                    label={h.label}
                    color={PURPLE}
                    variant={horizon === h.value ? "solid" : "outline"}
                    active={horizon === h.value}
                    onClick={() => setHorizon(h.value)}
                    size="md"
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 6 }}>RESTRICOES OU RECURSOS CONHECIDOS</div>
            <input
              className="orion-input"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="Ex: 8h/dia disponiveis, sem investir alem de R$X, sem mudar de cidade..."
            />
          </div>

          <button
            onClick={run}
            disabled={scenario.isPending || !question.trim()}
            className="orion-command"
            style={{
              color: PRIMARY,
              borderColor: `${PRIMARY}77`,
              background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
              marginTop: 14,
              fontSize: 11,
              padding: "12px 18px",
              boxShadow: `0 0 12px ${PRIMARY}33`,
              opacity: !question.trim() ? 0.4 : 1,
            }}
          >
            {scenario.isPending ? "◌ SIMULANDO CENARIOS..." : "▷ RODAR SIMULACAO"}
          </button>
        </section>

        {/* ━━━ RESULTADO ━━━ */}
        {scenario.data && (
          <>
            {/* Executive summary */}
            <section className="dash-section" style={{ animation: "fadeUp 0.5s ease both", borderColor: `${PRIMARY}44` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18, color: PRIMARY, textShadow: `0 0 10px ${PRIMARY}` }}>◇</span>
                <span className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.22em" }}>
                  SUMARIO EXECUTIVO
                </span>
              </div>
              <p style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.7,
                marginBottom: 14,
              }}>
                {scenario.data.executiveSummary}
              </p>
              {scenario.data.assumptions.length > 0 && (
                <div>
                  <div className="hud-label" style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, marginBottom: 6 }}>
                    PREMISSAS DO MODELO
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {scenario.data.assumptions.map((a) => (
                      <TagPill key={a} label={a} color={PRIMARY} variant="outline" size="xs" />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 3 outcomes side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }} className="hud-stagger">
              <OutcomeCard
                label="CENARIO PROVAVEL"
                icon="◇"
                text={scenario.data.likelyOutcome}
                color={PRIMARY}
                accent="HOJE"
              />
              <OutcomeCard
                label="MELHOR CASO"
                icon="▲"
                text={scenario.data.bestCase}
                color={SUCCESS}
                accent="UPSIDE"
              />
              <OutcomeCard
                label="PIOR CASO"
                icon="▼"
                text={scenario.data.worstCase}
                color={DANGER}
                accent="DOWNSIDE"
              />
            </div>

            {/* Decision matrix */}
            {scenario.data.decisionMatrix.length > 0 && (
              <section className="dash-section" style={{ animation: "fadeUp 0.5s ease 0.1s both" }}>
                <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14, letterSpacing: "0.22em" }}>
                  ◧ MATRIZ DE DECISAO
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }} className="hud-stagger">
                  {scenario.data.decisionMatrix.map((row) => {
                    const effort = EFFORT_META[row.effort];
                    const confPct = Math.round(row.confidence * 100);
                    return (
                      <article
                        key={row.option}
                        style={{
                          padding: "14px 16px",
                          borderRadius: 9,
                          border: `1px solid ${effort.color}33`,
                          borderLeft: `3px solid ${effort.color}`,
                          background: `linear-gradient(135deg, ${effort.color}10, transparent 70%)`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <strong style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 14,
                            color: "rgba(255,255,255,0.92)",
                            letterSpacing: "0.04em",
                          }}>
                            {row.option}
                          </strong>
                          <RingGauge
                            value={confPct}
                            centerLabel={`${confPct}%`}
                            bottomLabel="CONF"
                            color={confPct >= 70 ? SUCCESS : confPct >= 40 ? WARN : DANGER}
                            size={56}
                            thickness={4}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{
                            padding: "6px 8px",
                            background: `${SUCCESS}10`,
                            borderLeft: `2px solid ${SUCCESS}`,
                            borderRadius: 3,
                            fontSize: 11.5,
                            color: "rgba(255,255,255,0.75)",
                            lineHeight: 1.5,
                          }}>
                            <strong style={{ color: SUCCESS, fontSize: 8, letterSpacing: "0.2em", display: "block", marginBottom: 2 }}>
                              ▲ UPSIDE
                            </strong>
                            {row.upside}
                          </div>
                          <div style={{
                            padding: "6px 8px",
                            background: `${DANGER}10`,
                            borderLeft: `2px solid ${DANGER}`,
                            borderRadius: 3,
                            fontSize: 11.5,
                            color: "rgba(255,255,255,0.65)",
                            lineHeight: 1.5,
                          }}>
                            <strong style={{ color: DANGER, fontSize: 8, letterSpacing: "0.2em", display: "block", marginBottom: 2 }}>
                              ▼ DOWNSIDE
                            </strong>
                            {row.downside}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: `1px solid ${effort.color}22` }}>
                          <span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>
                            ESFORCO
                          </span>
                          <TagPill label={effort.label} color={effort.color} variant="solid" size="xs" />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Leading indicators + Next actions */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {scenario.data.leadingIndicators.length > 0 && (
                <section className="dash-section" style={{ borderColor: `${PURPLE}33` }}>
                  <div className="hud-label" style={{ color: PURPLE, fontSize: 10, marginBottom: 10, letterSpacing: "0.22em" }}>
                    ◉ INDICADORES LIDERANTES
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10, lineHeight: 1.4 }}>
                    Sinais antecipados que confirmam se a hipotese esta indo na direcao certa.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }} className="hud-stagger">
                    {scenario.data.leadingIndicators.map((indicator) => (
                      <li key={indicator} style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.72)",
                        lineHeight: 1.5,
                        paddingLeft: 16,
                        position: "relative",
                      }}>
                        <span style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          width: 5,
                          height: 5,
                          background: PURPLE,
                          boxShadow: `0 0 6px ${PURPLE}`,
                          transform: "rotate(45deg)",
                        }} />
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {scenario.data.nextActions.length > 0 && (
                <section className="dash-section" style={{ borderColor: `${SUCCESS}33` }}>
                  <div className="hud-label" style={{ color: SUCCESS, fontSize: 10, marginBottom: 10, letterSpacing: "0.22em" }}>
                    ▷ PROXIMAS ACOES
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10, lineHeight: 1.4 }}>
                    Movimentos especificos para testar a hipotese no horizonte definido.
                  </p>
                  <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9, counterReset: "act" }} className="hud-stagger">
                    {scenario.data.nextActions.map((action, i) => (
                      <li key={action} style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.72)",
                        lineHeight: 1.5,
                        paddingLeft: 26,
                        position: "relative",
                      }}>
                        <span style={{
                          position: "absolute",
                          left: 0,
                          top: 1,
                          fontFamily: "'Share Tech Mono', monospace",
                          color: SUCCESS,
                          fontSize: 11,
                          fontWeight: 700,
                          textShadow: `0 0 4px ${SUCCESS}`,
                        }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {action}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </>
        )}
      </div>
      <ModuleChat
        module="whatif"
        label="WHAT IF"
        color={PRIMARY}
        welcome="Posso simular cenarios financeiros, de carreira e de vida. Faca uma pergunta tipo 'e se eu...'"
        suggestions={["E se eu mudar de emprego?", "E se investir X por mes?", "E se eu me mudar?", "Simular aposentadoria"]}
      />
    </ModuleShell>
  );
}

function OutcomeCard({ label, icon, text, color, accent }: { label: string; icon: string; text: string; color: string; accent: string }): JSX.Element {
  return (
    <article style={{
      padding: "14px 16px",
      borderRadius: 9,
      border: `1px solid ${color}44`,
      background: `linear-gradient(135deg, ${color}15, transparent 70%)`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        padding: "3px 8px",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 7,
        color,
        background: `${color}22`,
        borderBottomLeftRadius: 6,
        letterSpacing: "0.22em",
      }}>
        {accent}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18, color, textShadow: `0 0 8px ${color}` }}>{icon}</span>
        <span className="hud-label" style={{ color, fontSize: 9, letterSpacing: "0.22em" }}>
          {label}
        </span>
      </div>
      <p style={{
        fontSize: 12.5,
        color: "rgba(255,255,255,0.78)",
        lineHeight: 1.6,
        margin: 0,
      }}>
        {text}
      </p>
    </article>
  );
}
