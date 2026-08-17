import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useMindsetCheckin } from "../../hooks/modules/useMindset.js";
import { RingGauge } from "../../components/visual/RingGauge.js";
import { TagPill } from "../../components/visual/TagPill.js";
import { HoloChart } from "../../components/visual/HoloChart.js";

const PRIMARY = "#7C3AED";
const ACCENT = "#00D4FF";

/* ═══════════════════════════════════════════════════════════════════
   MINDSET — daily state scan + intervencao da IA.

   Refeito: hero com 3 ring gauges (humor/energia/stress), sliders
   custom HUD, micro-sparkline de tendencia, e bloco de intervencao em
   3 estagios (pattern → intervention → reframe → next).
═══════════════════════════════════════════════════════════════════ */

const PRESET_NOTES = [
  { icon: "▲", label: "Ansioso", note: "Estou com a cabeca acelerada e pensamentos em loop." },
  { icon: "◐", label: "Travado", note: "Sei o que precisa ser feito mas nao consigo comecar." },
  { icon: "◯", label: "Cansado", note: "Acordei sem bateria, fisicamente exausto." },
  { icon: "✦", label: "Em fluxo", note: "Hoje me sinto em sintonia, motivado." },
];

export function MindsetPage(): JSX.Element {
  const checkin = useMindsetCheckin();
  const [mood, setMood] = useState(6);
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState("");

  // Sparkline ficticio (em prod virá do banco quando MindsetCheckin tiver mais dados)
  const recentMoodHistory = [mood - 2, mood + 1, mood - 1, mood, mood + 2, mood - 1, mood].map((v) =>
    Math.max(1, Math.min(10, v)),
  );

  const run = (): void => {
    checkin.mutate({ mood, energy, stress, note: note.trim() || undefined });
  };

  const inferredState =
    stress >= 7 ? { label: "ALERTA", color: "#EF4444", icon: "▲" }
    : energy <= 3 ? { label: "BAIXA ENERGIA", color: "#F59E0B", icon: "▽" }
    : mood >= 7 ? { label: "FLUXO", color: "#10B981", icon: "✦" }
    : { label: "ESTAVEL", color: ACCENT, icon: "◇" };

  return (
    <ModuleShell icon="◶" label="MINDSET" sub="State scan · padroes · regulacao emocional" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ━━━ HERO: estado inferido + 3 gauges ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                ESTADO INFERIDO AGORA
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 28, color: inferredState.color, textShadow: `0 0 12px ${inferredState.color}80` }}>
                  {inferredState.icon}
                </span>
                <strong style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 22,
                  color: inferredState.color,
                  letterSpacing: "0.12em",
                  textShadow: `0 0 8px ${inferredState.color}66`,
                }}>
                  {inferredState.label}
                </strong>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 8, maxWidth: 460, lineHeight: 1.5 }}>
                Calibrado dos seus sliders abaixo. A IA usa esses sinais junto com agenda e energia recente pra sugerir a melhor intervencao.
              </p>
            </div>
            <HoloChart
              points={recentMoodHistory}
              labels={["D-6","D-5","D-4","D-3","D-2","D-1","HOJE"]}
              color={PRIMARY}
              width={300}
              height={70}
            />
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            justifyItems: "center",
          }}>
            <RingGauge value={mood * 10} centerLabel={String(mood)} topLabel="HUMOR" bottomLabel="0 a 10" color="#10B981" size={120} />
            <RingGauge value={energy * 10} centerLabel={String(energy)} topLabel="ENERGIA" bottomLabel="0 a 10" color="#F59E0B" size={120} />
            <RingGauge value={stress * 10} centerLabel={String(stress)} topLabel="STRESS" bottomLabel="0 a 10" color={stress >= 7 ? "#EF4444" : "#EC4899"} size={120} />
          </div>
        </section>

        {/* ━━━ SLIDERS + presets + textarea ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14, letterSpacing: "0.22em" }}>
            DAILY STATE SCAN
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
            <SliderRow label="HUMOR" value={mood} setValue={setMood} color="#10B981" />
            <SliderRow label="ENERGIA" value={energy} setValue={setEnergy} color="#F59E0B" />
            <SliderRow label="STRESS" value={stress} setValue={setStress} color="#EC4899" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="hud-label" style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, marginBottom: 8 }}>
              ATALHOS RAPIDOS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PRESET_NOTES.map((p) => (
                <TagPill
                  key={p.label}
                  label={p.label}
                  icon={p.icon}
                  color={ACCENT}
                  variant={note === p.note ? "solid" : "outline"}
                  active={note === p.note}
                  onClick={() => setNote(p.note)}
                  size="md"
                />
              ))}
            </div>
          </div>

          <textarea
            className="orion-input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que esta acontecendo agora? (opcional — voce tambem pode escolher um atalho acima)"
            style={{ resize: "vertical" }}
          />
          <button
            onClick={run}
            disabled={checkin.isPending}
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
            {checkin.isPending ? "◌ ANALISANDO PADRAO..." : "▷ REGISTRAR CHECK-IN"}
          </button>
        </section>

        {/* ━━━ INTERVENCAO IA ━━━ */}
        {checkin.data && (
          <section className="dash-section" style={{ animation: "fadeUp 0.5s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div>
                <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                  PADRAO IDENTIFICADO
                </span>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}>
                  <strong style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 18,
                    color: PRIMARY,
                    letterSpacing: "0.1em",
                  }}>
                    {checkin.data.pattern.toUpperCase()}
                  </strong>
                  <TagPill label={new Date(checkin.data.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} color={ACCENT} size="xs" />
                </div>
              </div>
            </div>

            <div className="hud-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              <InterventionCard
                step="01"
                title="INTERVENCAO"
                body={checkin.data.intervention}
                color={ACCENT}
                icon="◆"
              />
              <InterventionCard
                step="02"
                title="REFRAME"
                body={checkin.data.reframe}
                color={PRIMARY}
                icon="◈"
              />
              <InterventionCard
                step="03"
                title="PROXIMA ACAO"
                body={checkin.data.nextAction}
                color="#10B981"
                icon="▷"
              />
            </div>
          </section>
        )}
      </div>
      <ModuleChat
        module="mindset"
        label="MINDSET"
        color={PRIMARY}
        welcome="Posso ajudar com regulacao emocional, identificar padroes de humor e sugerir intervencoes. Como esta se sentindo?"
        suggestions={["Check-in emocional", "Dicas de ansiedade", "Como ter mais energia", "Padroes de humor"]}
      />
    </ModuleShell>
  );
}

function SliderRow({ label, value, setValue, color }: { label: string; value: number; setValue: (v: number) => void; color: string }): JSX.Element {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      border: `1px solid ${color}22`,
      background: `linear-gradient(135deg, ${color}08, transparent)`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span className="hud-label" style={{ color, fontSize: 9, letterSpacing: "0.22em" }}>{label}</span>
        <strong style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 18,
          color,
          textShadow: `0 0 6px ${color}AA`,
        }}>
          {value}
        </strong>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="hud-slider"
        style={{ accentColor: color }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>BAIXO</span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>ALTO</span>
      </div>
    </div>
  );
}

function InterventionCard({ step, title, body, color, icon }: { step: string; title: string; body: string; color: string; icon: string }): JSX.Element {
  return (
    <article style={{
      padding: "14px 16px",
      borderRadius: 9,
      border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`,
      background: `linear-gradient(135deg, ${color}10, transparent 70%)`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        top: 8,
        right: 12,
        fontSize: 36,
        color: `${color}18`,
        fontFamily: "'Share Tech Mono', monospace",
        fontWeight: 700,
        pointerEvents: "none",
      }}>
        {step}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16, color, textShadow: `0 0 6px ${color}` }}>{icon}</span>
        <span className="hud-label" style={{ color, fontSize: 9, letterSpacing: "0.22em" }}>
          {title}
        </span>
      </div>
      <p style={{
        fontSize: 12.5,
        color: "rgba(255,255,255,0.72)",
        lineHeight: 1.6,
        margin: 0,
      }}>
        {body}
      </p>
    </article>
  );
}
