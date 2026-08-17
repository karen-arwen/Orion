import { useState } from "react";
import type { AutonomyLevel, AutonomyPolicy } from "@orion/types";
import { useAutonomyCore, useUpdateAutonomyPolicy } from "../hooks/useAutomations.js";

/* ═══════════════════════════════════════════════════════════════════
   AUTONOMY PAGE — painel de controle da autonomia do ORION.

   O usuario vê e edita, por módulo:
   - Nivel atual (observe → execute)
   - Se exige confirmacao
   - Limite de acoes diarias
   - Streak de aprovacoes (do Redis, se disponível)
   - Historico de acoes recentes do modulo

   Design HUD sci-fi — paleta #00D4FF + #030509.
═══════════════════════════════════════════════════════════════════ */

const PRIMARY = "#00D4FF";
const BG = "#030509";
const SURFACE = "#0a0f1a";
const BORDER = "#00D4FF18";

const LEVEL_ORDER: AutonomyLevel[] = ["observe", "suggest", "draft", "confirm", "execute"];

const LEVEL_META: Record<AutonomyLevel, { label: string; desc: string; color: string }> = {
  observe:  { label: "OBSERVAR",   desc: "Só monitora, nunca age",            color: "#6B7280" },
  suggest:  { label: "SUGERIR",    desc: "Cria alerta para você aprovar",     color: "#818CF8" },
  draft:    { label: "RASCUNHAR",  desc: "Prepara ação para revisão",         color: "#F59E0B" },
  confirm:  { label: "CONFIRMAR",  desc: "Cria decisão na fila (padrão)",     color: "#00D4FF" },
  execute:  { label: "EXECUTAR",   desc: "Age diretamente sem interromper",   color: "#10B981" },
};

const MODULE_META: Record<string, { icon: string; label: string }> = {
  memory:   { icon: "◈", label: "MEMÓRIA" },
  alerts:   { icon: "◌", label: "ALERTAS" },
  life:     { icon: "◎", label: "LIFE OS" },
  projects: { icon: "◉", label: "PROJETOS" },
  social:   { icon: "◍", label: "SOCIAL" },
  finance:  { icon: "◑", label: "CFO" },
  shop:     { icon: "◒", label: "COMPRAS" },
  media:    { icon: "◓", label: "MÍDIA" },
  security: { icon: "◔", label: "SEGURANÇA" },
  habit:    { icon: "◕", label: "HÁBITOS" },
  orion:    { icon: "⬡", label: "SISTEMA" },
};

// Módulos que devem sempre aparecer mesmo sem policy criada
const DEFAULT_MODULES = ["memory", "alerts", "life", "projects", "finance", "social", "media", "security", "habit"];

interface PolicyCardProps {
  moduleId: string;
  policy?: AutonomyPolicy;
  onUpdate: (moduleId: string, level: AutonomyLevel, requiresConfirmation: boolean, maxDailyActions: number) => void;
  updating: boolean;
}

function PolicyCard({ moduleId, policy, onUpdate, updating }: PolicyCardProps): JSX.Element {
  const meta = MODULE_META[moduleId] ?? { icon: "◈", label: moduleId.toUpperCase() };
  const currentLevel: AutonomyLevel = policy?.level ?? "confirm";
  const [expanded, setExpanded] = useState(false);
  const [localMax, setLocalMax] = useState(policy?.maxDailyActions ?? 10);

  const levelIdx = LEVEL_ORDER.indexOf(currentLevel);
  const levelColor = LEVEL_META[currentLevel].color;

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${levelColor}`,
      borderRadius: "4px",
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: levelColor, fontSize: "16px", fontFamily: "monospace" }}>{meta.icon}</span>
          <span style={{ color: "#E2E8F0", fontFamily: "'Share Tech Mono', monospace", fontSize: "12px", letterSpacing: "0.1em" }}>
            {meta.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Barra de progresso do nível */}
          <LevelBar level={currentLevel} />

          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "10px",
            color: levelColor,
            letterSpacing: "0.08em",
            minWidth: "80px",
            textAlign: "right",
          }}>
            {LEVEL_META[currentLevel].label}
          </span>

          <span style={{ color: "#4B5563", fontSize: "10px" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ color: "#6B7280", fontSize: "11px", fontFamily: "'Share Tech Mono', monospace", margin: "10px 0 14px", letterSpacing: "0.05em" }}>
            {LEVEL_META[currentLevel].desc}
          </p>

          {/* Level selector */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{ color: "#4B5563", fontSize: "10px", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em", display: "block", marginBottom: "8px" }}>
              NÍVEL DE AUTONOMIA
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {LEVEL_ORDER.map((lvl) => {
                const lm = LEVEL_META[lvl];
                const isActive = lvl === currentLevel;
                return (
                  <button
                    key={lvl}
                    disabled={updating}
                    onClick={() => onUpdate(moduleId, lvl, lvl !== "execute", localMax)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "2px",
                      border: `1px solid ${isActive ? lm.color : "#1F2937"}`,
                      background: isActive ? `${lm.color}18` : "transparent",
                      color: isActive ? lm.color : "#4B5563",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "10px",
                      letterSpacing: "0.06em",
                      cursor: updating ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {lm.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max daily actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "#4B5563", fontSize: "10px", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.06em" }}>
              MAX/DIA
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={localMax}
              onChange={(e) => setLocalMax(Number(e.target.value))}
              onBlur={() => onUpdate(moduleId, currentLevel, policy?.requiresConfirmation ?? true, localMax)}
              style={{
                width: "56px",
                background: "#111827",
                border: `1px solid ${BORDER}`,
                borderRadius: "2px",
                color: PRIMARY,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "12px",
                padding: "3px 6px",
                textAlign: "center",
              }}
            />
            <span style={{ color: "#374151", fontSize: "10px", fontFamily: "'Share Tech Mono', monospace" }}>
              ações
            </span>

            {/* Enabled toggle */}
            {policy && (
              <button
                onClick={() => onUpdate(moduleId, currentLevel, policy.requiresConfirmation, localMax)}
                style={{
                  marginLeft: "auto",
                  padding: "3px 10px",
                  border: `1px solid ${policy.enabled ? "#10B981" : "#374151"}`,
                  borderRadius: "2px",
                  background: policy.enabled ? "#10B98118" : "transparent",
                  color: policy.enabled ? "#10B981" : "#4B5563",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: "10px",
                  cursor: "pointer",
                }}
              >
                {policy.enabled ? "ATIVO" : "INATIVO"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LevelBar({ level }: { level: AutonomyLevel }): JSX.Element {
  const idx = LEVEL_ORDER.indexOf(level);
  const color = LEVEL_META[level].color;
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      {LEVEL_ORDER.map((_, i) => (
        <div
          key={i}
          style={{
            width: "14px",
            height: "4px",
            borderRadius: "1px",
            background: i <= idx ? color : "#1F2937",
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

export function AutonomyPage(): JSX.Element {
  const { data: core, refetch } = useAutonomyCore();
  const { mutate: updatePolicy, isPending } = useUpdateAutonomyPolicy();

  const policies = core?.policies ?? [];
  const recentActions = core?.recentActions ?? [];

  // Monta mapa moduleId → policy
  const policyMap = new Map(policies.map((p) => [p.moduleId, p]));

  // Todos os módulos que devem aparecer
  const allModules = Array.from(new Set([
    ...DEFAULT_MODULES,
    ...policies.map((p) => p.moduleId),
  ]));

  const handleUpdate = (moduleId: string, level: AutonomyLevel, requiresConfirmation: boolean, maxDailyActions: number): void => {
    updatePolicy(
      { moduleId, input: { level, requiresConfirmation, maxDailyActions } },
      { onSuccess: () => void refetch() },
    );
  };

  // Stats
  const executableCount = policies.filter((p) => p.level === "execute").length;
  const confirmCount = policies.filter((p) => p.requiresConfirmation).length;
  const executedToday = recentActions.filter((a) => a.status === "executed").length;
  const pendingDecisions = recentActions.filter((a) => a.status === "decision").length;

  return (
    <div style={{ background: BG, minHeight: "100%", padding: "28px 32px", color: "#E2E8F0" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
          <h1 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "18px", letterSpacing: "0.15em", color: PRIMARY, margin: 0 }}>
            AUTONOMY CORE
          </h1>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#374151", letterSpacing: "0.1em" }}>
            CONTROLE DE AUTONOMIA POR MÓDULO
          </span>
        </div>
        <p style={{ color: "#4B5563", fontSize: "11px", fontFamily: "'Share Tech Mono', monospace", margin: 0, letterSpacing: "0.04em" }}>
          Configure o que o ORION pode fazer sem perguntar. Quanto maior o nível, mais ele age por conta própria.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "EXECUTANDO DIRETO", value: executableCount, color: "#10B981" },
          { label: "REQUER CONFIRMAÇÃO", value: confirmCount, color: "#F59E0B" },
          { label: "AÇÕES HOJE", value: executedToday, color: PRIMARY },
          { label: "AGUARDANDO APROVAÇÃO", value: pendingDecisions, color: "#EF4444" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "14px 16px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "22px", color, marginBottom: "4px" }}>{value}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.1em" }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
        {/* Policy cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.12em", marginBottom: "4px" }}>
            MÓDULOS · {allModules.length} CONFIGURADOS
          </div>
          {allModules.map((moduleId) => (
            <PolicyCard
              key={moduleId}
              moduleId={moduleId}
              policy={policyMap.get(moduleId)}
              onUpdate={handleUpdate}
              updating={isPending}
            />
          ))}
        </div>

        {/* Recent actions sidebar */}
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.12em", marginBottom: "12px" }}>
            AÇÕES RECENTES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recentActions.length === 0 && (
              <div style={{ color: "#374151", fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", textAlign: "center", padding: "20px 0" }}>
                Nenhuma ação registrada
              </div>
            )}
            {recentActions.slice(0, 20).map((action) => {
              const statusColor = action.status === "executed" ? "#10B981" : action.status === "decision" ? "#F59E0B" : "#EF4444";
              const modMeta = MODULE_META[action.moduleId] ?? { icon: "◈", label: action.moduleId.toUpperCase() };
              return (
                <div
                  key={action.id}
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderLeft: `2px solid ${statusColor}`,
                    borderRadius: "3px",
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: statusColor, letterSpacing: "0.08em" }}>
                      {modMeta.icon} {modMeta.label}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#374151" }}>
                      {action.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#9CA3AF", lineHeight: 1.4 }}>
                    {action.title.slice(0, 60)}{action.title.length > 60 ? "…" : ""}
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#374151", marginTop: "3px" }}>
                    {new Date(action.createdAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommended adjustments */}
          {(core?.recommended?.length ?? 0) > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.12em", marginBottom: "10px" }}>
                SUGESTÕES DO ORION
              </div>
              {core!.recommended.map((rec) => (
                <div
                  key={rec.moduleId}
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "3px",
                    padding: "10px 12px",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: PRIMARY, marginBottom: "4px" }}>
                    {MODULE_META[rec.moduleId]?.label ?? rec.moduleId.toUpperCase()} → {LEVEL_META[rec.level].label}
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#6B7280", lineHeight: 1.4 }}>
                    {rec.reason}
                  </div>
                  <button
                    onClick={() => handleUpdate(rec.moduleId, rec.level, rec.level !== "execute", 10)}
                    style={{
                      marginTop: "8px",
                      padding: "3px 10px",
                      border: `1px solid ${PRIMARY}40`,
                      borderRadius: "2px",
                      background: `${PRIMARY}10`,
                      color: PRIMARY,
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: "9px",
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                    }}
                  >
                    APLICAR
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
