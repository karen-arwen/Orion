import { useState } from "react";
import type { UserProfile } from "@orion/types";
import { StatusDot } from "../visual/StatusDot.js";
import { api } from "../../lib/api.js";
import { useAlertsStore } from "../../stores/alerts.store.js";

interface AutoPanelProps {
  profile: UserProfile;
  onSendToChat: (text: string) => void;
}

interface AutoEntry {
  name: string;
  trigger: string;
  color: string;
  on: boolean;
  actions: string[];
}

export function AutoPanel({ profile, onSendToChat }: AutoPanelProps): JSX.Element {
  const c = profile.theme.primary;
  const refetchAlerts = useAlertsStore((s) => s.fetch);
  const [briefState, setBriefState] = useState<"idle" | "running" | "ok" | "err">("idle");

  const handleTriggerBrief = async (): Promise<void> => {
    setBriefState("running");
    try {
      await api.triggerMorningBrief();
      await refetchAlerts();
      setBriefState("ok");
      setTimeout(() => setBriefState("idle"), 3500);
    } catch {
      setBriefState("err");
      setTimeout(() => setBriefState("idle"), 3500);
    }
  };

  const autos: AutoEntry[] = [
    { name: "Modo Foco", trigger: "Abrir notebook", color: "#10B981", on: true, actions: ["Bloquear distrações", "Abrir IDE", "DnD ativo"] },
    { name: "Morning Brief", trigger: "08:00 · dias úteis", color: c, on: true, actions: ["Resumir emails", "Agenda do dia", "3 prioridades"] },
    { name: "Rotina Noturna", trigger: "22:30 diariamente", color: "#7C3AED", on: true, actions: ["Resumo do dia", "Checklist amanhã", "Relax mode"] },
    { name: "Deal Watch", trigger: "Wishlist · -40% preço", color: "#F59E0B", on: false, actions: ["Notificar", "Mostrar trailer", "Aguardar OK"] },
    { name: "GitHub Nudge", trigger: "3 dias sem commit", color: "#EF4444", on: true, actions: ["Alertar", "Sugerir tarefa rápida"] },
    { name: "Content Planner", trigger: "Seg/Qua/Sex · 10h", color: "#EC4899", on: false, actions: ["3 ideias de post", "Trends", "Rascunho"] },
  ];

  return (
    <div style={{ overflowY: "auto", padding: "20px 22px", flex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.19)" }}>
          ⚙ AUTOMATION STUDIO
        </div>
        <button
          onClick={handleTriggerBrief}
          disabled={briefState === "running"}
          className="hud-label"
          style={{
            padding: "6px 12px",
            fontSize: 9,
            background:
              briefState === "ok"
                ? "rgba(16,185,129,0.18)"
                : briefState === "err"
                ? "rgba(239,68,68,0.18)"
                : `linear-gradient(135deg, ${c}20, rgba(245,158,11,0.12))`,
            border: `1px solid ${
              briefState === "ok" ? "#10B981" : briefState === "err" ? "#EF4444" : c + "45"
            }`,
            color:
              briefState === "ok" ? "#10B981" : briefState === "err" ? "#EF4444" : c,
            borderRadius: 6,
            cursor: briefState === "running" ? "wait" : "pointer",
          }}
        >
          {briefState === "running"
            ? "GERANDO…"
            : briefState === "ok"
            ? "✓ ALERTA CRIADO"
            : briefState === "err"
            ? "✗ ERRO"
            : "▷ MORNING BRIEF AGORA"}
        </button>
      </div>
      {autos.map((a, i) => (
        <div
          key={a.name}
          style={{
            padding: 14,
            marginBottom: 9,
            background: "rgba(255,255,255,0.015)",
            border: `1px solid ${a.on ? a.color + "25" : "rgba(255,255,255,0.03)"}`,
            borderRadius: 9,
            animation: `fadeUp ${0.1 + i * 0.07}s ease`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
            <StatusDot active={a.on} color={a.color} pulse={a.on} />
            <span style={{ fontSize: 12, fontWeight: 600, color: a.on ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.21)" }}>
              {a.name}
            </span>
            <span
              className="hud-label"
              style={{ marginLeft: "auto", fontSize: 8, color: "rgba(255,255,255,0.12)" }}
            >
              TRIGGER: {a.trigger}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {a.actions.map((ac) => (
              <span
                key={ac}
                style={{
                  padding: "2px 7px",
                  fontSize: 8,
                  borderRadius: 20,
                  background: `${a.color}10`,
                  border: `1px solid ${a.color}22`,
                  color: `${a.color}99`,
                  fontFamily: "'Share Tech Mono', monospace",
                }}
              >
                {ac}
              </span>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => onSendToChat("Cria uma nova automação personalizada pra mim")}
        className="hud-label"
        style={{
          width: "100%",
          padding: 11,
          marginTop: 6,
          background: "transparent",
          border: `1px dashed ${c}25`,
          color: `${c}80`,
          borderRadius: 9,
          cursor: "pointer",
          fontSize: 10,
        }}
      >
        + NOVA AUTOMAÇÃO
      </button>
    </div>
  );
}
