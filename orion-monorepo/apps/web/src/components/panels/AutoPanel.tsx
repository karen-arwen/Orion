import { useState } from "react";
import type { Automation, TriggerType, UserProfile } from "@orion/types";
import { StatusDot } from "../visual/StatusDot.js";
import { api } from "../../lib/api.js";
import { useAlertsStore } from "../../stores/alerts.store.js";
import {
  useAutomationOverview,
  useAutonomyCore,
  useAutomations,
  useUpdateAutonomyPolicy,
  useToggleAutomation,
  useTriggerAutomation,
  useSeedDefaultAutomations,
  useDeleteAutomation,
} from "../../hooks/useAutomations.js";
import {
  useApproveDecision,
  useDecisions,
  useDismissDecision,
  useSyncDecisions,
} from "../../hooks/useDecisions.js";

interface AutoPanelProps {
  profile: UserProfile;
  onSendToChat: (text: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════
   Painel de Automações — agora ligado ao backend real.

   Mostra todas Automations do usuário com:
   - toggle enabled (rosca instantânea no banco + repeating jobs)
   - botão TRIGGER (dispara imediato pra testar)
   - botão DELETE (com confirm nativo)
   - cor por triggerType
   - última execução
═══════════════════════════════════════════════════════════════════ */

const TRIGGER_META: Record<TriggerType, { label: string; color: string }> = {
  cron: { label: "AGENDADO", color: "#00D4FF" },
  temporal: { label: "AGENDADO", color: "#00D4FF" },
  event: { label: "EVENTO", color: "#7C3AED" },
  behavioral: { label: "COMPORT", color: "#F59E0B" },
  contextual: { label: "CONTEXTO", color: "#10B981" },
  manual: { label: "MANUAL", color: "#64748B" },
};

function describeTrigger(a: Automation): string {
  if (a.triggerType === "cron") {
    const cfg = a.triggerConfig as { cron?: string };
    return cfg.cron ? `cron: ${cfg.cron}` : "agendado";
  }
  if (a.triggerType === "behavioral") {
    const cfg = a.triggerConfig as { days_since?: number; metric?: string };
    return cfg.days_since ? `${cfg.days_since}d sem ${cfg.metric ?? "evento"}` : "comportamental";
  }
  if (a.triggerType === "event") {
    const cfg = a.triggerConfig as { event?: string; threshold_pct?: number };
    return cfg.event ?? "evento";
  }
  return a.triggerType;
}

export function AutoPanel({ profile, onSendToChat }: AutoPanelProps): JSX.Element {
  const c = profile.theme.primary;
  const { data: autos, isLoading, error } = useAutomations();
  const { data: overview } = useAutomationOverview();
  const { data: autonomyCore, refetch: refetchAutonomyCore } = useAutonomyCore();
  const { data: decisions } = useDecisions();
  const toggle = useToggleAutomation();
  const trigger = useTriggerAutomation();
  const seed = useSeedDefaultAutomations();
  const remove = useDeleteAutomation();
  const syncDecisions = useSyncDecisions();
  const approveDecision = useApproveDecision();
  const dismissDecision = useDismissDecision();
  const updatePolicy = useUpdateAutonomyPolicy();
  const refetchAlerts = useAlertsStore((s) => s.fetch);
  const scanAlerts = useAlertsStore((s) => s.scan);

  const [briefState, setBriefState] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [scanState, setScanState] = useState<"idle" | "running" | "ok" | "err">("idle");

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

  const handleTriggerAuto = async (a: Automation): Promise<void> => {
    try {
      await trigger.mutateAsync(a.id);
      await refetchAlerts();
    } catch {
      // silencioso — query mostra estado real no próximo refresh
    }
  };

  const handleScan = async (): Promise<void> => {
    setScanState("running");
    const result = await scanAlerts();
    if (result) {
      await syncDecisions.mutateAsync();
      await refetchAutonomyCore();
    }
    setScanState(result ? "ok" : "err");
    setTimeout(() => setScanState("idle"), 3500);
  };

  const handleApproveDecision = async (id: string): Promise<void> => {
    const result = await approveDecision.mutateAsync(id);
    await refetchAlerts();
    onSendToChat(
      result.executed && result.execution
        ? `Ação executada: ${result.execution.summary}`
        : result.action,
    );
  };

  const enabledCount = overview?.enabled ?? autos?.filter((a) => a.enabled).length ?? 0;
  const totalCount = overview?.total ?? autos?.length ?? 0;
  const autonomyScore = overview?.autonomyScore ?? (totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0);
  const scoreColor = autonomyScore >= 75 ? "#10B981" : autonomyScore >= 45 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ overflowY: "auto", padding: "20px 22px", flex: 1 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.19)" }}>
          ⚙ AUTOMATION STUDIO
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(autos?.length ?? 0) === 0 && !isLoading && (
            <button
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="hud-label"
              style={{
                padding: "6px 12px",
                fontSize: 9,
                background: "rgba(124,58,237,0.18)",
                border: "1px solid #7C3AED",
                color: "#7C3AED",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {seed.isPending ? "PLANTANDO…" : "✦ INSTALAR 7 PRÉ-CONFIG"}
            </button>
          )}
          <button
            onClick={handleScan}
            disabled={scanState === "running"}
            className="hud-label"
            style={{
              padding: "6px 12px",
              fontSize: 9,
              background:
                scanState === "ok"
                  ? "rgba(16,185,129,0.18)"
                  : scanState === "err"
                  ? "rgba(239,68,68,0.18)"
                  : "rgba(255,255,255,0.025)",
              border: `1px solid ${
                scanState === "ok" ? "#10B981" : scanState === "err" ? "#EF4444" : c + "35"
              }`,
              color: scanState === "ok" ? "#10B981" : scanState === "err" ? "#EF4444" : c,
              borderRadius: 6,
              cursor: scanState === "running" ? "wait" : "pointer",
            }}
          >
            {scanState === "running"
              ? "VARR. SINAIS..."
              : scanState === "ok"
              ? "✓ SINAIS OK"
              : scanState === "err"
              ? "✕ ERRO"
              : "SCAN PROATIVO"}
          </button>
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
      </div>

      <section className="autonomy-center">
        <div className="autonomy-score" style={{ borderColor: `${scoreColor}45`, background: `${scoreColor}0f` }}>
          <span className="hud-label" style={{ color: scoreColor }}>AUTONOMIA</span>
          <strong style={{ color: scoreColor }}>{autonomyScore}</strong>
          <small>{overview?.mode ?? "NORMAL"} · {enabledCount}/{totalCount} ativas</small>
        </div>
        <div className="autonomy-metric">
          <span className="hud-label" style={{ color: c }}>ALERTAS</span>
          <strong>{overview?.pendingAlerts ?? 0}</strong>
          <small>{overview?.criticalAlerts ?? 0} alta prioridade</small>
        </div>
        <div className="autonomy-metric">
          <span className="hud-label" style={{ color: "#10B981" }}>24H</span>
          <strong>{overview?.last24hRuns ?? 0}</strong>
          <small>{overview?.failedLast24h ?? 0} falhas</small>
        </div>
      </section>

      {overview?.recent && overview.recent.length > 0 && (
        <section className="autonomy-recent">
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.22)", fontSize: 9 }}>EXECUÇÕES RECENTES</div>
          <div className="autonomy-timeline">
            {overview.recent.slice(0, 4).map((log) => {
              const ok = log.status === "success" || log.status === "executed" || log.status === "confirmed";
              return (
                <div key={log.id} className="autonomy-log">
                  <span style={{ background: ok ? "#10B981" : log.status === "failed" ? "#EF4444" : "#F59E0B" }} />
                  <div>
                    <strong>{log.automationName}</strong>
                    <small>
                      {log.status} · {new Date(log.triggeredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="autonomy-policy-core">
        <div className="autonomy-policy-head">
          <div>
            <div className="hud-label" style={{ color: c, fontSize: 10 }}>AUTONOMY CORE</div>
            <p>Permissoes por modulo: observe, sugira, prepare, confirme ou execute.</p>
          </div>
          <div className="autonomy-policy-stats">
            <span>{autonomyCore?.modulesObserved ?? 0} ativos</span>
            <span>{autonomyCore?.confirmationRequired ?? 0} com OK</span>
            <span>{autonomyCore?.modulesExecutable ?? 0} executam</span>
          </div>
        </div>
        <div className="autonomy-policy-grid">
          {(autonomyCore?.policies ?? []).slice(0, 8).map((policy) => (
            <article key={policy.id} className={policy.enabled ? "autonomy-policy-card" : "autonomy-policy-card disabled"}>
              <div className="autonomy-policy-card-head">
                <strong>{policy.moduleId.toUpperCase()}</strong>
                <button
                  onClick={() => updatePolicy.mutate({ moduleId: policy.moduleId, input: { enabled: !policy.enabled } })}
                  className={policy.enabled ? "autonomy-policy-toggle on" : "autonomy-policy-toggle"}
                >
                  {policy.enabled ? "ON" : "OFF"}
                </button>
              </div>
              <select
                value={policy.level}
                onChange={(event) =>
                  updatePolicy.mutate({
                    moduleId: policy.moduleId,
                    input: { level: event.target.value as typeof policy.level },
                  })
                }
              >
                <option value="observe">observe</option>
                <option value="suggest">suggest</option>
                <option value="draft">draft</option>
                <option value="confirm">confirm</option>
                <option value="execute">execute</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={policy.requiresConfirmation}
                  onChange={(event) =>
                    updatePolicy.mutate({
                      moduleId: policy.moduleId,
                      input: { requiresConfirmation: event.target.checked },
                    })
                  }
                />
                exige aprovacao
              </label>
              <div className="autonomy-policy-limits">
                <label>
                  <span>limite/dia</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={policy.maxDailyActions}
                    onChange={(event) =>
                      updatePolicy.mutate({
                        moduleId: policy.moduleId,
                        input: { maxDailyActions: Number(event.target.value) },
                      })
                    }
                  />
                </label>
                <label>
                  <span>silencio</span>
                  <input
                    type="time"
                    value={policy.quietHoursStart ?? ""}
                    onChange={(event) =>
                      updatePolicy.mutate({
                        moduleId: policy.moduleId,
                        input: { quietHoursStart: event.target.value || null },
                      })
                    }
                  />
                  <input
                    type="time"
                    value={policy.quietHoursEnd ?? ""}
                    onChange={(event) =>
                      updatePolicy.mutate({
                        moduleId: policy.moduleId,
                        input: { quietHoursEnd: event.target.value || null },
                      })
                    }
                  />
                </label>
              </div>
              <small>{policy.rules[0] ?? "Sem regra especifica."}</small>
            </article>
          ))}
        </div>
        {(autonomyCore?.recentActions ?? []).length > 0 && (
          <div className="autonomy-policy-audit">
            <div className="hud-label" style={{ color: "rgba(255,255,255,0.28)", fontSize: 9 }}>AUDITORIA DO CHAT EXECUTOR</div>
            {(autonomyCore?.recentActions ?? []).slice(0, 5).map((action) => {
              const color = action.status === "executed" ? "#10B981" : action.status === "blocked" ? "#EF4444" : "#F59E0B";
              return (
                <div key={action.id} className="autonomy-log">
                  <span style={{ background: color }} />
                  <div>
                    <strong>{action.title}</strong>
                    <small>
                      {action.moduleId.toUpperCase()} · {action.status} · {new Date(action.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {(autonomyCore?.recommended ?? []).length > 0 && (
          <div className="autonomy-policy-recs">
            {autonomyCore?.recommended.map((rec) => (
              <button
                key={rec.moduleId}
                onClick={() => updatePolicy.mutate({ moduleId: rec.moduleId, input: { level: rec.level, enabled: true } })}
              >
                <span className="hud-label">{rec.moduleId} → {rec.level}</span>
                <small>{rec.reason}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="decision-inbox">
        <div className="decision-inbox-head">
          <div>
            <div className="hud-label" style={{ color: c, fontSize: 10 }}>DECISION INBOX</div>
            <p>Acoes que o Orion pode executar, mas precisa de aprovacao.</p>
          </div>
          <button
            className="orion-command"
            onClick={() => syncDecisions.mutate()}
            disabled={syncDecisions.isPending}
            style={{ color: c, borderColor: `${c}45`, background: `${c}10` }}
          >
            {syncDecisions.isPending ? "SYNC..." : "SYNC ALERTAS"}
          </button>
        </div>
        {(decisions ?? []).length === 0 ? (
          <div className="decision-empty">Nenhuma decisao pendente. Rode um scan proativo ou gere alertas.</div>
        ) : (
          <div className="decision-list">
            {(decisions ?? []).slice(0, 5).map((decision) => {
              const color = decision.priority === "critical" || decision.priority === "high" ? "#F59E0B" : c;
              return (
                <article key={decision.id} className="decision-card" style={{ borderColor: `${color}35` }}>
                  <div>
                    <span className="hud-label" style={{ color, fontSize: 8 }}>{decision.priority}</span>
                    <strong>{decision.title}</strong>
                    <p>{decision.summary}</p>
                    <small>{decision.proposedAction}</small>
                    {Boolean(decision.payload.internalAction) &&
                      typeof decision.payload.internalAction === "object" &&
                      !Array.isArray(decision.payload.internalAction) && (
                        <small style={{ color: "#10B981" }}>
                          EXECUTOR: {String((decision.payload.internalAction as { type?: unknown }).type ?? "acao interna")}
                        </small>
                      )}
                  </div>
                  <div className="decision-actions">
                    <button
                      onClick={() => void handleApproveDecision(decision.id)}
                      disabled={approveDecision.isPending}
                      className="orion-command"
                      style={{ color, borderColor: `${color}45`, background: `${color}10` }}
                    >
                      APROVAR
                    </button>
                    <button
                      onClick={() => dismissDecision.mutate(decision.id)}
                      disabled={dismissDecision.isPending}
                      className="orion-command"
                    >
                      DISPENSAR
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isLoading && (
        <div
          className="hud-label"
          style={{ color: "rgba(255,255,255,0.3)", padding: 40, textAlign: "center" }}
        >
          ◌ carregando automações…
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#EF4444",
            fontSize: 12,
          }}
        >
          ✗ {(error as Error).message}
        </div>
      )}

      {autos && autos.length === 0 && !isLoading && (
        <div
          style={{
            padding: 20,
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(124,58,237,0.3)",
            borderRadius: 10,
            textAlign: "center",
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Você ainda não tem automações.
          <br />
          Clica em <strong style={{ color: "#7C3AED" }}>+ INSTALAR 7 PRÉ-CONFIG</strong> pra começar:
          Morning Brief, Rotina Noturna, Content Planner, GitHub Nudge, Energy Check, Modo Foco, Deal Watch.
        </div>
      )}

      {autos &&
        autos.map((a, i) => {
          const meta = TRIGGER_META[a.triggerType] ?? { label: a.triggerType.toUpperCase(), color: "#64748B" };
          return (
            <div
              key={a.id}
              style={{
                padding: 14,
                marginBottom: 9,
                background: "rgba(255,255,255,0.015)",
                border: `1px solid ${a.enabled ? meta.color + "25" : "rgba(255,255,255,0.03)"}`,
                borderRadius: 9,
                animation: `fadeUp ${0.1 + i * 0.05}s ease`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                <StatusDot active={a.enabled} color={meta.color} pulse={a.enabled} />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: a.enabled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {a.name}
                </span>
                <span
                  className="hud-label"
                  style={{
                    fontSize: 7,
                    padding: "2px 6px",
                    border: `1px solid ${meta.color}40`,
                    color: meta.color,
                    borderRadius: 3,
                  }}
                >
                  {meta.label}
                </span>
                {a.requiresConfirmation && (
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      padding: "2px 6px",
                      border: "1px solid rgba(245,158,11,0.4)",
                      color: "#F59E0B",
                      borderRadius: 3,
                    }}
                  >
                    PEDE OK
                  </span>
                )}
                <span
                  className="hud-label"
                  style={{
                    marginLeft: "auto",
                    fontSize: 8,
                    color: "rgba(255,255,255,0.18)",
                  }}
                >
                  {describeTrigger(a)}
                </span>
              </div>

              {a.description && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {a.description}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => toggle.mutate({ id: a.id, enabled: !a.enabled })}
                  className="hud-label"
                  style={{
                    padding: "4px 10px",
                    fontSize: 9,
                    background: a.enabled ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${a.enabled ? "#10B98155" : "rgba(255,255,255,0.1)"}`,
                    color: a.enabled ? "#10B981" : "rgba(255,255,255,0.4)",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  {a.enabled ? "✓ ATIVA" : "○ DESATIVADA"}
                </button>
                <button
                  onClick={() => handleTriggerAuto(a)}
                  disabled={trigger.isPending}
                  className="hud-label"
                  style={{
                    padding: "4px 10px",
                    fontSize: 9,
                    background: `${c}15`,
                    border: `1px solid ${c}40`,
                    color: c,
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  ▷ DISPARAR AGORA
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Apagar a automação "${a.name}"?`)) remove.mutate(a.id);
                  }}
                  className="hud-label"
                  style={{
                    padding: "4px 8px",
                    fontSize: 9,
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "rgba(239,68,68,0.7)",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
                {a.lastTriggered && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 9,
                      color: "rgba(255,255,255,0.25)",
                      fontFamily: "'Share Tech Mono', monospace",
                      alignSelf: "center",
                    }}
                  >
                    último: {new Date(a.lastTriggered).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          );
        })}

      <button
        onClick={() => onSendToChat("Cria uma nova automação personalizada pra mim")}
        className="hud-label"
        style={{
          width: "100%",
          padding: 11,
          marginTop: 14,
          background: "transparent",
          border: `1px dashed ${c}25`,
          color: `${c}80`,
          borderRadius: 9,
          cursor: "pointer",
          fontSize: 10,
        }}
      >
        + CRIAR NOVA AUTOMAÇÃO VIA IA
      </button>
    </div>
  );
}
