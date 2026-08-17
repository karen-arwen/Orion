import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { OrionMode } from "@orion/types";
import { useUser } from "@clerk/clerk-react";
import { Particles } from "../components/visual/Particles.js";
import { NeuralRing } from "../components/visual/NeuralRing.js";
import { api } from "../lib/api.js";

const PRIMARY = "#00D4FF";

type CommunicationStyle = "direto" | "detalhado" | "estrategico" | "provocativo";
type DecisionStyle = "rapido" | "analitico" | "cauteloso";

const MODE_OPTIONS: Array<{ id: OrionMode; label: string; desc: string; color: string }> = [
  { id: "SILENCIOSO", label: "SILENCIOSO", desc: "So alertas criticos. Zero ruido.", color: "#64748B" },
  { id: "NORMAL", label: "NORMAL", desc: "Proativo com bom senso. Sugere quando agrega.", color: PRIMARY },
  { id: "STARK", label: "STARK", desc: "Antecipa, cruza sinais e provoca movimento.", color: "#F59E0B" },
];

const FOCUS_AREAS = [
  { id: "life", label: "LIFE OS", icon: "◎", desc: "tarefas, rotina, prioridade" },
  { id: "career", label: "CARREIRA", icon: "↑", desc: "vagas, portfolio, entrevistas" },
  { id: "finance", label: "CFO", icon: "◆", desc: "gastos, metas, assinaturas" },
  { id: "health", label: "SAUDE", icon: "♡", desc: "energia, sono, foco" },
  { id: "creative", label: "CRIACAO", icon: "✦", desc: "ideias, midia, gaming" },
  { id: "social", label: "SOCIAL", icon: "◫", desc: "networking, CRM pessoal" },
  { id: "security", label: "SEGURANCA", icon: "⬡", desc: "guard, privacidade, 2FA" },
  { id: "know", label: "CONHECIMENTO", icon: "◉", desc: "estudo, idioma, tutor" },
];

const HOBBY_CHIPS = [
  "anime",
  "games",
  "dev",
  "design",
  "produto",
  "IA",
  "cinema",
  "musica",
  "fitness",
  "culinaria",
  "viagem",
  "moda",
  "skin care",
  "leitura",
  "negocios",
];

const LIMITS = [
  "Nao enviar mensagens sem meu OK",
  "Nao criar eventos sem confirmar data e hora",
  "Nao gastar dinheiro nem comprar nada",
  "Nao mexer em dados sensiveis sem explicar",
  "Nao me interromper com coisa pequena",
  "Sempre explicar por que sugeriu algo",
];

export function OnboardingScreen(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<OrionMode>("NORMAL");
  const [focusAreas, setFocusAreas] = useState<string[]>(["life"]);
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle>("estrategico");
  const [decisionStyle, setDecisionStyle] = useState<DecisionStyle>("analitico");
  const [workArea, setWorkArea] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [autonomyLimits, setAutonomyLimits] = useState<string[]>([
    "Nao enviar mensagens sem meu OK",
    "Nao gastar dinheiro nem comprar nada",
  ]);
  const [submitting, setSubmitting] = useState(false);

  const primaryModule = focusAreas[0] ?? "life";

  const toggle = (value: string, current: string[], set: (next: string[]) => void, max = 99): void => {
    if (current.includes(value)) {
      set(current.filter((item) => item !== value));
      return;
    }
    if (current.length >= max) return;
    set([...current, value]);
  };

  const canNext = (): boolean => {
    if (step === 2) return focusAreas.length > 0;
    if (step === 4) return workArea.trim().length > 0;
    return true;
  };

  const handleComplete = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await api.onboarding.complete({
        mode,
        primaryModule,
        focusAreas,
        workArea,
        hobbies,
        goal,
        communicationStyle,
        decisionStyle,
        autonomyLimits,
      });
      navigate("/", { replace: true });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-shell">
      <Particles color={PRIMARY} />
      <header className="onboarding-header">
        <NeuralRing color={PRIMARY} size={46} />
        <div>
          <div className="hud-label text-glow" style={{ fontSize: 18, color: PRIMARY }}>O.R.I.O.N</div>
          <div className="hud-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
            CALIBRACAO INICIAL · PASSO {step} DE 5
          </div>
        </div>
        <div className="onboarding-user">{user?.firstName ? `Operador: ${user.firstName}` : ""}</div>
      </header>

      <div className="onboarding-progress"><i style={{ width: `${(step / 5) * 100}%` }} /></div>

      <main className="onboarding-main">
        {step === 1 && (
          <Panel title="Nivel de presenca" subtitle="Defina o quanto o Orion deve se antecipar.">
            <div className="onboarding-option-stack">
              {MODE_OPTIONS.map((item) => (
                <button key={item.id} onClick={() => setMode(item.id)} className={mode === item.id ? "onboarding-mode active" : "onboarding-mode"} style={{ borderLeftColor: item.color }}>
                  <span className="hud-label" style={{ color: item.color }}>{item.label}</span>
                  <strong>{item.desc}</strong>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 2 && (
          <Panel title="Frentes prioritarias" subtitle="Escolha ate 4 areas. A primeira vira o modulo principal.">
            <div className="onboarding-focus-grid">
              {FOCUS_AREAS.map((area) => (
                <button key={area.id} onClick={() => toggle(area.id, focusAreas, setFocusAreas, 4)} className={focusAreas.includes(area.id) ? "onboarding-focus active" : "onboarding-focus"}>
                  <span>{area.icon}</span>
                  <div>
                    <strong>{area.label}</strong>
                    <small>{area.desc}</small>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 3 && (
          <Panel title="Estilo operacional" subtitle="Aqui o Orion aprende como falar e como decidir com voce.">
            <div className="onboarding-two-col">
              <ChoiceGroup
                title="Comunicacao"
                value={communicationStyle}
                onChange={(value) => setCommunicationStyle(value as CommunicationStyle)}
                options={[
                  ["direto", "curto, objetivo, sem volta"],
                  ["detalhado", "contexto e explicacao"],
                  ["estrategico", "sintese + proximo movimento"],
                  ["provocativo", "questiona, tensiona e cobra clareza"],
                ]}
              />
              <ChoiceGroup
                title="Decisao"
                value={decisionStyle}
                onChange={(value) => setDecisionStyle(value as DecisionStyle)}
                options={[
                  ["rapido", "menos analise, mais acao"],
                  ["analitico", "tradeoffs antes de agir"],
                  ["cauteloso", "risco e confirmacao primeiro"],
                ]}
              />
            </div>
          </Panel>
        )}

        {step === 4 && (
          <Panel title="Identidade e gosto" subtitle="Isso alimenta memoria, recomendacoes e linguagem do sistema.">
            <label className="onboarding-field">
              <span className="hud-label">AREA DE TRABALHO</span>
              <input value={workArea} onChange={(event) => setWorkArea(event.target.value)} placeholder="Ex: full-stack dev, designer, estudante, founder..." />
            </label>
            <div className="onboarding-chip-block">
              <span className="hud-label">INTERESSES</span>
              <div>
                {HOBBY_CHIPS.map((hobby) => (
                  <button key={hobby} onClick={() => toggle(hobby, hobbies, setHobbies)} className={hobbies.includes(hobby) ? "active" : ""}>
                    {hobby}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        )}

        {step === 5 && (
          <Panel title="Objetivo e limites" subtitle="O Orion deve agir, mas com fronteiras claras.">
            <label className="onboarding-field">
              <span className="hud-label">OBJETIVO DO MES</span>
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={4} placeholder="Ex: transformar o Orion em um MVP vendavel, conseguir entrevista, organizar rotina..." />
            </label>
            <div className="onboarding-chip-block">
              <span className="hud-label">LIMITES DE AUTONOMIA</span>
              <div>
                {LIMITS.map((limit) => (
                  <button key={limit} onClick={() => toggle(limit, autonomyLimits, setAutonomyLimits)} className={autonomyLimits.includes(limit) ? "active" : ""}>
                    {limit}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        )}
      </main>

      <footer className="onboarding-footer">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="orion-command">
          VOLTAR
        </button>
        {step < 5 ? (
          <button onClick={() => canNext() && setStep((s) => s + 1)} disabled={!canNext()} className="orion-command onboarding-next">
            PROXIMO
          </button>
        ) : (
          <button onClick={handleComplete} disabled={submitting} className="orion-command onboarding-next">
            {submitting ? "CALIBRANDO..." : "INICIALIZAR ORION"}
          </button>
        )}
      </footer>
    </div>
  );
}

function Panel(props: { title: string; subtitle: string; children: ReactNode }): JSX.Element {
  return (
    <section className="onboarding-panel">
      <h2>{props.title}</h2>
      <p>{props.subtitle}</p>
      {props.children}
    </section>
  );
}

function ChoiceGroup(props: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}): JSX.Element {
  return (
    <div className="onboarding-choice-group">
      <span className="hud-label">{props.title}</span>
      {props.options.map(([value, label]) => (
        <button key={value} onClick={() => props.onChange(value)} className={props.value === value ? "active" : ""}>
          <strong>{value}</strong>
          <small>{label}</small>
        </button>
      ))}
    </div>
  );
}
