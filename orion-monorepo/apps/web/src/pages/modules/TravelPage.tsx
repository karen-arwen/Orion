import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useTravelPlan } from "../../hooks/modules/useTravel.js";
import { TimelineRail, type TimelineNode } from "../../components/visual/TimelineRail.js";
import { TagPill } from "../../components/visual/TagPill.js";

const PRIMARY = "#00D4FF";
const RISK_COLOR = "#EF4444";
const ACTION_COLOR = "#10B981";

/* ═══════════════════════════════════════════════════════════════════
   TRAVEL — gerador de roteiro com IA, agora com timeline visual.

   Refeito: header com destino destacado em tela, chips de interesses
   selecionaveis, timeline vertical com nodes por dia (3 segmentos
   manha/tarde/noite + logistica), risks + nextActions em painel lateral.
═══════════════════════════════════════════════════════════════════ */

const INTEREST_PRESETS = [
  { icon: "♨", label: "Gastronomia" },
  { icon: "♠", label: "Cultura" },
  { icon: "☘", label: "Natureza" },
  { icon: "♬", label: "Vida noturna" },
  { icon: "✦", label: "Tech / Geek" },
  { icon: "◆", label: "Compras" },
  { icon: "▲", label: "Aventura" },
  { icon: "☕", label: "Cafes" },
];

const PACE_OPTIONS = [
  { value: "leve", label: "LEVE", color: "#10B981" },
  { value: "equilibrado", label: "EQUILIBRADO", color: PRIMARY },
  { value: "intenso", label: "INTENSO", color: "#F59E0B" },
] as const;

const BUDGET_OPTIONS = [
  { value: "baixo", label: "BAIXO", color: "#10B981" },
  { value: "medio", label: "MEDIO", color: PRIMARY },
  { value: "alto", label: "ALTO", color: "#EC4899" },
] as const;

export function TravelPage(): JSX.Element {
  const plan = useTravelPlan();
  const [destination, setDestination] = useState("São Paulo");
  const [days, setDays] = useState(3);
  const [pace, setPace] = useState<"leve" | "equilibrado" | "intenso">("equilibrado");
  const [budget, setBudget] = useState<"baixo" | "medio" | "alto">("medio");
  const [interests, setInterests] = useState<string[]>(["Gastronomia", "Cultura", "Cafes"]);
  const [constraints, setConstraints] = useState("");
  const [flightOrigin, setFlightOrigin] = useState("");
  const [flightDest, setFlightDest] = useState("");
  const [flightMaxPrice, setFlightMaxPrice] = useState("");
  const [monitoredFlights, setMonitoredFlights] = useState<Array<{id: string; origin: string; dest: string; maxPrice: number; addedAt: string}>>([]);

  const addFlightMonitor = (): void => {
    if (!flightOrigin.trim() || !flightDest.trim()) return;
    setMonitoredFlights((prev) => [...prev, { id: crypto.randomUUID(), origin: flightOrigin.trim().toUpperCase(), dest: flightDest.trim().toUpperCase(), maxPrice: Number(flightMaxPrice) || 0, addedAt: new Date().toISOString() }]);
    setFlightOrigin(""); setFlightDest(""); setFlightMaxPrice("");
  };

  const toggleInterest = (label: string): void => {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label],
    );
  };

  const run = (): void => {
    plan.mutate({
      destination,
      days,
      budget,
      pace,
      interests,
      constraints: constraints.trim() || undefined,
    });
  };

  return (
    <ModuleShell icon="◁" label="TRAVEL" sub="Architect · roteiros com camada de logistica" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ━━━ HERO ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                DESTINO
              </span>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Para onde?"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 28,
                  color: PRIMARY,
                  letterSpacing: "0.08em",
                  textShadow: `0 0 12px ${PRIMARY}66`,
                  width: "100%",
                  padding: "4px 0",
                  borderBottom: `1px dashed ${PRIMARY}33`,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <TagPill icon="◷" label={`${days} dia${days > 1 ? "s" : ""}`} color={PRIMARY} variant="solid" />
                <TagPill icon="◆" label={pace} color={PACE_OPTIONS.find((p) => p.value === pace)?.color ?? PRIMARY} />
                <TagPill icon="$" label={`budget ${budget}`} color={BUDGET_OPTIONS.find((b) => b.value === budget)?.color ?? PRIMARY} />
                <TagPill label={`${interests.length} interesses`} color="#7C3AED" />
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ CONFIG ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14, letterSpacing: "0.22em" }}>
            PARAMETROS DA ROTA
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
            {/* Dias */}
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 6 }}>DIAS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setDays((d) => Math.max(1, d - 1))}
                  className="orion-command"
                  style={{ padding: "6px 12px", color: PRIMARY, borderColor: `${PRIMARY}44` }}
                >−</button>
                <strong style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 26,
                  color: PRIMARY,
                  textShadow: `0 0 8px ${PRIMARY}66`,
                  minWidth: 32,
                  textAlign: "center",
                }}>{days}</strong>
                <button
                  onClick={() => setDays((d) => Math.min(30, d + 1))}
                  className="orion-command"
                  style={{ padding: "6px 12px", color: PRIMARY, borderColor: `${PRIMARY}44` }}
                >+</button>
              </div>
            </div>

            {/* Pace */}
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 6 }}>RITMO</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {PACE_OPTIONS.map((p) => (
                  <TagPill
                    key={p.value}
                    label={p.label}
                    color={p.color}
                    variant={pace === p.value ? "solid" : "outline"}
                    active={pace === p.value}
                    onClick={() => setPace(p.value)}
                  />
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 6 }}>ORCAMENTO</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {BUDGET_OPTIONS.map((b) => (
                  <TagPill
                    key={b.value}
                    label={b.label}
                    color={b.color}
                    variant={budget === b.value ? "solid" : "outline"}
                    active={budget === b.value}
                    onClick={() => setBudget(b.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>
              INTERESSES (toque para incluir/excluir)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {INTEREST_PRESETS.map((p) => (
                <TagPill
                  key={p.label}
                  label={p.label}
                  icon={p.icon}
                  color={PRIMARY}
                  variant={interests.includes(p.label) ? "solid" : "outline"}
                  active={interests.includes(p.label)}
                  onClick={() => toggleInterest(p.label)}
                  size="md"
                />
              ))}
            </div>
          </div>

          <input
            className="orion-input"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="Restricoes opcionais (vegetariano, mobilidade, alergia, etc)"
          />
          <button
            onClick={run}
            disabled={plan.isPending}
            className="orion-command"
            style={{
              color: PRIMARY,
              borderColor: `${PRIMARY}77`,
              background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
              marginTop: 12,
              fontSize: 11,
              padding: "12px 18px",
              boxShadow: `0 0 12px ${PRIMARY}33`,
            }}
          >
            {plan.isPending ? "◌ CALCULANDO ROTA..." : "▷ GERAR ROTEIRO"}
          </button>
        </section>

        {/* ━━━ RESULTADO ━━━ */}
        {plan.data && (
          <>
            <section className="dash-section" style={{ animation: "fadeUp 0.5s ease both" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>ROTEIRO GERADO</span>
                  <strong style={{
                    display: "block",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 20,
                    color: PRIMARY,
                    marginTop: 4,
                    textShadow: `0 0 8px ${PRIMARY}55`,
                  }}>
                    {plan.data.destination}
                  </strong>
                </div>
                <TagPill label={`${plan.data.days.length} dias mapeados`} color={ACTION_COLOR} variant="solid" />
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.66)", lineHeight: 1.6, marginBottom: 14 }}>
                {plan.data.summary}
              </p>

              {plan.data.assumptions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="hud-label" style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, marginBottom: 6 }}>
                    PREMISSAS
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {plan.data.assumptions.map((a) => (
                      <TagPill key={a} label={a} color={PRIMARY} variant="outline" size="xs" />
                    ))}
                  </div>
                </div>
              )}

              <TimelineRail
                color={PRIMARY}
                nodes={plan.data.days.map<TimelineNode>((d) => ({
                  id: `day-${d.day}`,
                  badge: `DIA ${d.day}`,
                  title: d.title,
                  body: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <DaySegment icon="☀" label="MANHA" text={d.morning} color="#F59E0B" />
                      <DaySegment icon="◐" label="TARDE" text={d.afternoon} color={PRIMARY} />
                      <DaySegment icon="☾" label="NOITE" text={d.night} color="#7C3AED" />
                      <DaySegment icon="◇" label="LOGISTICA" text={d.logistics} color="rgba(255,255,255,0.5)" />
                    </div>
                  ),
                }))}
              />
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {plan.data.risks.length > 0 && (
                <section className="dash-section" style={{ borderColor: `${RISK_COLOR}33` }}>
                  <div className="hud-label" style={{ color: RISK_COLOR, fontSize: 10, marginBottom: 10, letterSpacing: "0.22em" }}>
                    △ RISCOS
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {plan.data.risks.map((risk) => (
                      <li key={risk} style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.72)",
                        lineHeight: 1.5,
                        paddingLeft: 14,
                        position: "relative",
                      }}>
                        <span style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: RISK_COLOR,
                          boxShadow: `0 0 6px ${RISK_COLOR}`,
                        }} />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {plan.data.nextActions.length > 0 && (
                <section className="dash-section" style={{ borderColor: `${ACTION_COLOR}33` }}>
                  <div className="hud-label" style={{ color: ACTION_COLOR, fontSize: 10, marginBottom: 10, letterSpacing: "0.22em" }}>
                    ▷ PROXIMAS ACOES
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {plan.data.nextActions.map((action, i) => (
                      <li key={action} style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.72)",
                        lineHeight: 1.5,
                        paddingLeft: 24,
                        position: "relative",
                      }}>
                        <span style={{
                          position: "absolute",
                          left: 0,
                          top: 1,
                          fontFamily: "'Share Tech Mono', monospace",
                          color: ACTION_COLOR,
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}


        {/* Flight Monitor */}
        <section style={{ marginTop: 20, padding: 18, background: "linear-gradient(135deg, rgba(0,212,255,0.05), transparent)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12 }}>
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em", marginBottom: 14 }}>{"\u{2708}"} MONITOR DE VOOS</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input value={flightOrigin} onChange={(e) => setFlightOrigin(e.target.value)} placeholder="Origem (ex: GRU)" className="orion-input" style={{ flex: 1, minWidth: 80 }} />
            <input value={flightDest} onChange={(e) => setFlightDest(e.target.value)} placeholder="Destino (ex: ICN)" className="orion-input" style={{ flex: 1, minWidth: 80 }} />
            <input value={flightMaxPrice} onChange={(e) => setFlightMaxPrice(e.target.value)} placeholder="Preço máx (R$)" type="number" className="orion-input" style={{ flex: 1, minWidth: 100 }} />
            <button onClick={addFlightMonitor} disabled={!flightOrigin.trim() || !flightDest.trim()} className="orion-command" style={{ color: PRIMARY, borderColor: PRIMARY + "55", background: PRIMARY + "14" }}>+ MONITORAR</button>
          </div>
          {monitoredFlights.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 11, border: "1px dashed rgba(0,212,255,0.15)", borderRadius: 6 }}>Adicione rotas para monitorar. O ORION avisa quando encontrar preços bons.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {monitoredFlights.map((f) => (
                <div key={f.id} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,212,255,0.15)", borderLeft: "3px solid " + PRIMARY, borderRadius: 6, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: PRIMARY, fontWeight: 700 }}>{f.origin} {"\u{2192}"} {f.dest}</span>
                  {f.maxPrice > 0 && (<span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>{"\u{2264}"} R${f.maxPrice}</span>)}
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>monitorando</span>
                  <button onClick={() => setMonitoredFlights((prev) => prev.filter((x) => x.id !== f.id))} style={{ padding: "2px 6px", fontSize: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.5)", borderRadius: 3, cursor: "pointer" }}>x</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>{"\u{1F6C8}"} Monitoramento via Brave Search · Notificação push quando preço cair</div>
        </section>

      </div>
      <ModuleChat
        module="travel"
        label="VIAGENS"
        color={PRIMARY}
        welcome="Posso montar roteiros, buscar voos, sugerir hospedagens e organizar toda a logistica da sua viagem. Pra onde quer ir?"
        suggestions={["Roteiro 5 dias Tokyo", "Viagem barata Europa", "Fim de semana SP", "Checklist de viagem"]}
      />
    </ModuleShell>
  );
}

function DaySegment({ icon, label, text, color }: { icon: string; label: string; text: string; color: string }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ fontSize: 12, color, marginTop: 2, minWidth: 14, textShadow: `0 0 4px ${color}` }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 8,
          color,
          letterSpacing: "0.22em",
          marginRight: 6,
        }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
          {text}
        </span>
      </div>
    </div>
  );
}
