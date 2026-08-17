import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════
   ONBOARDING TOUR — tooltips guiados que ensinam o ORION ao vivo.

   Aparece 1x apos o primeiro login (pos-onboarding).
   Cada step aponta pra um elemento do DOM via CSS selector.
   O tour destaca o elemento com spotlight + tooltip animado.
═══════════════════════════════════════════════════════════════════ */

interface TourStep {
  selector: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  action?: string; // texto do botao de acao (ex: "Experimentar")
  actionCmd?: string; // comando enviado ao chat se clicar
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: ".orion-topbar",
    title: "Barra de comando",
    description: "Seu HUD principal. Mostra hora, modo do ORION, integrações conectadas e atalhos. Clique no relogio pra abrir o Command Palette (Ctrl+K).",
    position: "bottom",
  },
  {
    selector: ".orion-sidebar",
    title: "Modulos",
    description: "24 modulos organizados por categoria. Cada um e uma area da sua vida que o ORION gerencia. Clique pra abrir a pagina dedicada.",
    position: "right",
  },
  {
    selector: ".orion-center-panel",
    title: "Nexus Chat",
    description: "Seu canal direto com o ORION. Pode pedir qualquer coisa: 'analisa meus habitos', 'planeja uma viagem', 'responde esse email'. Ele usa ferramentas reais.",
    position: "top",
    action: "Testar agora",
    actionCmd: "Me apresente suas capacidades em 3 frases.",
  },
  {
    selector: ".orion-tabs",
    title: "Abas do painel",
    description: "NEXUS CHAT pra conversar, PAINEL pra ver seu dashboard com momentum score e calendario, AUTOMACOES pra ver o que o ORION faz sozinho.",
    position: "bottom",
  },
  {
    selector: ".orion-right-rail",
    title: "Status e alertas",
    description: "Alertas proativos, decisoes pendentes e status das integrações. O ORION te avisa aqui quando detecta algo importante.",
    position: "left",
  },
];

interface Props {
  color: string;
  onComplete: () => void;
  onSendToChat?: (text: string) => void;
}

export function OnboardingTour({ color, onComplete, onSendToChat }: Props): JSX.Element | null {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(true);

  const currentStep = TOUR_STEPS[step];

  const updateTarget = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updateTarget();
    window.addEventListener("resize", updateTarget);
    return () => window.removeEventListener("resize", updateTarget);
  }, [updateTarget]);

  const next = (): void => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setVisible(false);
      localStorage.setItem("orion_tour_done", "1");
      onComplete();
    }
  };

  const skip = (): void => {
    setVisible(false);
    localStorage.setItem("orion_tour_done", "1");
    onComplete();
  };

  if (!visible || !currentStep) return null;

  // Tooltip position
  const tooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const gap = 12;
    const base: React.CSSProperties = { position: "fixed", zIndex: 10001 };

    switch (currentStep.position) {
      case "bottom":
        return { ...base, top: targetRect.bottom + gap, left: targetRect.left + targetRect.width / 2, transform: "translateX(-50%)" };
      case "top":
        return { ...base, bottom: window.innerHeight - targetRect.top + gap, left: targetRect.left + targetRect.width / 2, transform: "translateX(-50%)" };
      case "right":
        return { ...base, top: targetRect.top + targetRect.height / 2, left: targetRect.right + gap, transform: "translateY(-50%)" };
      case "left":
        return { ...base, top: targetRect.top + targetRect.height / 2, right: window.innerWidth - targetRect.left + gap, transform: "translateY(-50%)" };
    }
  };

  return (
    <>
      {/* Overlay escuro com spotlight */}
      <div
        onClick={skip}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.7)",
          cursor: "pointer",
        }}
      />

      {/* Spotlight no elemento alvo */}
      {targetRect && (
        <div
          style={{
            position: "fixed",
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 8,
            border: `2px solid ${color}60`,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.7), 0 0 20px ${color}30`,
            zIndex: 10000,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          style={{
            ...tooltipStyle(),
            maxWidth: 320,
            padding: "16px 20px",
            background: "rgba(5,8,16,0.97)",
            border: `1px solid ${color}35`,
            borderRadius: 10,
            backdropFilter: "blur(20px)",
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 15px ${color}15`,
          }}
        >
          {/* Step counter */}
          <div style={{
            fontSize: 9,
            fontFamily: "'Share Tech Mono', monospace",
            color: `${color}88`,
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}>
            PASSO {step + 1}/{TOUR_STEPS.length}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "'Rajdhani', sans-serif",
            color: "rgba(255,255,255,0.9)",
            marginBottom: 6,
          }}>
            {currentStep.title}
          </div>

          {/* Description */}
          <div style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.6,
            fontFamily: "'Share Tech Mono', monospace",
            marginBottom: 14,
          }}>
            {currentStep.description}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {currentStep.action && currentStep.actionCmd && (
              <button
                onClick={() => {
                  onSendToChat?.(currentStep.actionCmd!);
                  next();
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: 10,
                  fontFamily: "'Share Tech Mono', monospace",
                  background: `${color}18`,
                  border: `1px solid ${color}40`,
                  color,
                  borderRadius: 6,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                {currentStep.action.toUpperCase()}
              </button>
            )}
            <button
              onClick={next}
              style={{
                padding: "6px 14px",
                fontSize: 10,
                fontFamily: "'Share Tech Mono', monospace",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)",
                borderRadius: 6,
                cursor: "pointer",
                letterSpacing: "0.06em",
              }}
            >
              {step < TOUR_STEPS.length - 1 ? "PROXIMO" : "CONCLUIR"}
            </button>
            <button
              onClick={skip}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.2)",
                fontSize: 10,
                cursor: "pointer",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              PULAR
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/** Checa se o tour ja foi completado */
export function shouldShowTour(): boolean {
  return !localStorage.getItem("orion_tour_done");
}
