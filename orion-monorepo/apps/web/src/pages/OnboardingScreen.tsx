import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OrionMode } from "@orion/types";
import { useUser } from "@clerk/clerk-react";
import { Particles } from "../components/visual/Particles.js";
import { NeuralRing } from "../components/visual/NeuralRing.js";
import { api } from "../lib/api.js";

const PRIMARY = "#00D4FF";

const MODE_OPTIONS: Array<{ id: OrionMode; label: string; desc: string; color: string }> = [
  {
    id: "SILENCIOSO",
    label: "SILENCIOSO",
    desc: "Só fala quando é crítico. Você no comando.",
    color: "#64748B",
  },
  {
    id: "NORMAL",
    label: "NORMAL",
    desc: "Proativo com bom senso. Sugere quando agrega.",
    color: PRIMARY,
  },
  {
    id: "STARK",
    label: "STARK",
    desc: "Antecipa tudo. Vira seu copiloto. Modo Jarvis.",
    color: "#F59E0B",
  },
];

const FOCUS_AREAS = [
  { id: "comms", label: "COMUNICAÇÃO", icon: "◈", desc: "Email e mensagens" },
  { id: "life", label: "LIFE OS", icon: "◎", desc: "Tarefas e rotina" },
  { id: "career", label: "CARREIRA", icon: "↑", desc: "Crescimento e oportunidades" },
  { id: "know", label: "CONHECIMENTO", icon: "◉", desc: "Estudo e tutoria" },
  { id: "creative", label: "CRIAÇÃO", icon: "✦", desc: "Conteúdo e ideias" },
  { id: "health", label: "BEM-ESTAR", icon: "♡", desc: "Saúde, foco, hábitos" },
];

const HOBBY_CHIPS = [
  "anime",
  "games",
  "leitura",
  "dev",
  "design",
  "tarot",
  "música",
  "fitness",
  "cinema",
  "culinária",
  "viagem",
  "cosplay",
  "make",
  "skin care",
  "pets",
];

export function OnboardingScreen(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<OrionMode>("NORMAL");
  const [primaryModule, setPrimaryModule] = useState("life");
  const [workArea, setWorkArea] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await api.onboarding.complete({ mode, primaryModule, workArea, hobbies, goal });
      navigate("/", { replace: true });
    } catch {
      setSubmitting(false);
    }
  };

  const canNext = (): boolean => {
    if (step === 1) return Boolean(mode);
    if (step === 2) return Boolean(primaryModule);
    if (step === 3) return workArea.trim().length > 0;
    return true;
  };

  const toggleHobby = (h: string): void => {
    setHobbies((curr) => (curr.includes(h) ? curr.filter((x) => x !== h) : [...curr, h]));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #030509 0%, #050810 50%, #030509 100%)",
        color: "#fff",
        fontFamily: "'Rajdhani', sans-serif",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Particles color={PRIMARY} />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          padding: "32px 32px 14px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <NeuralRing color={PRIMARY} size={46} />
        <div>
          <div className="hud-label text-glow" style={{ fontSize: 18, color: PRIMARY }}>
            O.R.I.O.N
          </div>
          <div
            className="hud-label"
            style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}
          >
            INICIALIZAÇÃO · PASSO {step} DE 4
          </div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          {user?.firstName ? `Bem-vindo(a), ${user.firstName}` : ""}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ position: "relative", zIndex: 5, padding: "0 32px 24px" }}>
        <div
          style={{
            height: 2,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(step / 4) * 100}%`,
              height: "100%",
              background: PRIMARY,
              transition: "width 0.5s ease",
              boxShadow: `0 0 8px ${PRIMARY}`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          position: "relative",
          zIndex: 5,
          padding: "0 32px 32px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 26, color: PRIMARY, marginBottom: 8, textShadow: `0 0 12px ${PRIMARY}40` }}>
              Como prefere que eu seja?
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
              Você pode mudar isso depois a qualquer momento.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    padding: 16,
                    background: mode === m.id ? `${m.color}15` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${mode === m.id ? m.color : "rgba(255,255,255,0.08)"}`,
                    borderLeft: `3px solid ${m.color}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    className="hud-label"
                    style={{ fontSize: 11, color: m.color, marginBottom: 4 }}
                  >
                    {m.label}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: 26, color: PRIMARY, marginBottom: 8 }}>
              Qual área da sua vida mais precisa de atenção agora?
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
              Vou priorizar esse módulo. Os outros continuam disponíveis.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {FOCUS_AREAS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPrimaryModule(f.id)}
                  style={{
                    padding: 14,
                    background: primaryModule === f.id ? `${PRIMARY}15` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${primaryModule === f.id ? PRIMARY : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      color: primaryModule === f.id ? PRIMARY : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {f.icon}
                  </span>
                  <div>
                    <div
                      className="hud-label"
                      style={{
                        fontSize: 10,
                        color: primaryModule === f.id ? PRIMARY : "rgba(255,255,255,0.65)",
                      }}
                    >
                      {f.label}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontSize: 26, color: PRIMARY, marginBottom: 8 }}>
              Conta um pouco sobre você
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
              Isso vira a base do que eu sei sobre você desde o primeiro dia.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label
                className="hud-label"
                style={{ fontSize: 10, color: PRIMARY, marginBottom: 6, display: "block" }}
              >
                Qual sua área de trabalho?
              </label>
              <input
                value={workArea}
                onChange={(e) => setWorkArea(e.target.value)}
                placeholder='Ex: "Full-stack dev", "Designer UX", "Estudante de medicina"'
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${PRIMARY}30`,
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                className="hud-label"
                style={{ fontSize: 10, color: PRIMARY, marginBottom: 6, display: "block" }}
              >
                Hobbies / interesses (multi-select)
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {HOBBY_CHIPS.map((h) => (
                  <button
                    key={h}
                    onClick={() => toggleHobby(h)}
                    className="hud-label"
                    style={{
                      padding: "5px 11px",
                      fontSize: 10,
                      background: hobbies.includes(h) ? `${PRIMARY}25` : "transparent",
                      border: `1px solid ${hobbies.includes(h) ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                      color: hobbies.includes(h) ? PRIMARY : "rgba(255,255,255,0.5)",
                      borderRadius: 20,
                      cursor: "pointer",
                    }}
                  >
                    {hobbies.includes(h) ? "✓ " : ""}
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 style={{ fontSize: 26, color: PRIMARY, marginBottom: 8 }}>
              Seu principal objetivo este mês?
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
              Livre. Eu vou alinhar minhas sugestões com isso.
            </p>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='Ex: "Lançar o MVP do meu app até o fim do mês", "Conseguir entrevista em tech multinacional"'
              rows={5}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${PRIMARY}30`,
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                fontFamily: "'Rajdhani', sans-serif",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </>
        )}
      </div>

      {/* Footer nav */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          padding: 24,
          borderTop: `1px solid ${PRIMARY}15`,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="hud-label"
          style={{
            padding: "10px 18px",
            fontSize: 10,
            background: "transparent",
            border: `1px solid rgba(255,255,255,0.15)`,
            color: "rgba(255,255,255,0.5)",
            borderRadius: 6,
            cursor: step === 1 ? "not-allowed" : "pointer",
            opacity: step === 1 ? 0.3 : 1,
          }}
        >
          ← VOLTAR
        </button>
        {step < 4 && (
          <button
            onClick={() => canNext() && setStep((s) => s + 1)}
            disabled={!canNext()}
            className="hud-label"
            style={{
              padding: "10px 24px",
              fontSize: 11,
              background: `linear-gradient(135deg, ${PRIMARY}30, rgba(124,58,237,0.2))`,
              border: `1px solid ${PRIMARY}`,
              color: PRIMARY,
              borderRadius: 6,
              cursor: canNext() ? "pointer" : "not-allowed",
              opacity: canNext() ? 1 : 0.4,
              boxShadow: canNext() ? `0 0 12px ${PRIMARY}30` : "none",
            }}
          >
            PRÓXIMO →
          </button>
        )}
        {step === 4 && (
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="hud-label"
            style={{
              padding: "10px 24px",
              fontSize: 11,
              background: `linear-gradient(135deg, ${PRIMARY}40, rgba(16,185,129,0.25))`,
              border: `1px solid #10B981`,
              color: "#10B981",
              borderRadius: 6,
              cursor: "pointer",
              boxShadow: `0 0 12px #10B98130`,
            }}
          >
            {submitting ? "INICIALIZANDO…" : "▶ INICIALIZAR O.R.I.O.N."}
          </button>
        )}
      </div>
    </div>
  );
}
