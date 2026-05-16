import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useCareerCoach } from "../../hooks/modules/useCareer.js";

type Mode = "portfolio" | "entrevista" | "plano_90" | "review" | "livre";

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: "livre", label: "LIVRE", hint: "Pergunta aberta" },
  { id: "portfolio", label: "PORTFÓLIO", hint: "Análise + plano de evolução" },
  { id: "entrevista", label: "ENTREVISTA", hint: "Prep técnico, behavioral, perguntas" },
  { id: "plano_90", label: "30/60/90", hint: "Plano de marcos próximos 90 dias" },
  { id: "review", label: "REVIEW", hint: "Feedback sobre situação/decisão" },
];

interface QA {
  q: string;
  a: string;
  mode: Mode;
}

export function CareerPage(): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("livre");
  const [history, setHistory] = useState<QA[]>([]);
  const coach = useCareerCoach();

  const handleAsk = (): void => {
    const q = prompt.trim();
    if (!q || coach.isPending) return;
    setPrompt("");
    coach.mutate(
      { prompt: q, mode },
      {
        onSuccess: (data) => {
          setHistory((h) => [{ q, a: data.answer, mode }, ...h]);
        },
      },
    );
  };

  const selectedMode = MODES.find((m) => m.id === mode);

  return (
    <ModuleShell icon="↑" label="CARREIRA" sub="Coach · Portfólio · Vagas" color="#F59E0B">
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Mode selector */}
        <div style={{ marginBottom: 18 }}>
          <div
            className="hud-label"
            style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}
          >
            MODO:
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="hud-label"
                style={{
                  padding: "6px 12px",
                  fontSize: 10,
                  background: mode === m.id ? "rgba(245,158,11,0.2)" : "transparent",
                  border: `1px solid ${mode === m.id ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                  color: mode === m.id ? "#F59E0B" : "rgba(255,255,255,0.4)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {selectedMode && (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              → {selectedMode.hint}
            </div>
          )}
        </div>

        {/* Input */}
        <div
          style={{
            padding: 16,
            marginBottom: 24,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 10,
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === "entrevista"
                ? "Ex: 'me prepara pra entrevista de full-stack mid-level na X'"
                : mode === "portfolio"
                ? "Ex: 'revisa meu portfólio focado em vaga de design system'"
                : mode === "plano_90"
                ? "Ex: 'plano 30/60/90 pra virar pleno até dezembro'"
                : "Diga o que está te tirando o sono…"
            }
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
              fontFamily: "'Rajdhani', sans-serif",
              outline: "none",
              resize: "vertical",
              marginBottom: 10,
            }}
          />
          <button
            onClick={handleAsk}
            disabled={!prompt.trim() || coach.isPending}
            className="hud-label"
            style={{
              padding: "8px 16px",
              fontSize: 10,
              background: "rgba(245,158,11,0.2)",
              border: "1px solid #F59E0B",
              color: "#F59E0B",
              borderRadius: 6,
              cursor: prompt.trim() ? "pointer" : "not-allowed",
              opacity: prompt.trim() ? 1 : 0.4,
            }}
          >
            {coach.isPending ? "ANALISANDO…" : "▶ CONSULTAR COACH"}
          </button>
        </div>

        {/* History */}
        {history.length === 0 && !coach.isPending && (
          <div
            className="hud-label"
            style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 40 }}
          >
            Coach silencioso. Diga o desafio.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {history.map((qa, i) => (
            <div key={i}>
              <div
                style={{
                  fontSize: 9,
                  color: "#F59E0B",
                  fontFamily: "'Share Tech Mono', monospace",
                  letterSpacing: "0.15em",
                  marginBottom: 4,
                }}
              >
                [{qa.mode.toUpperCase()}]
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 8,
                  paddingLeft: 12,
                  borderLeft: "2px solid rgba(255,255,255,0.15)",
                }}
              >
                {qa.q}
              </div>
              <div
                style={{
                  padding: 16,
                  background: "rgba(245,158,11,0.05)",
                  border: "1px solid rgba(245,158,11,0.18)",
                  borderRadius: 8,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {qa.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModuleShell>
  );
}
