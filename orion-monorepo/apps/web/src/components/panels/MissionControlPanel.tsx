import { useState } from "react";
import type { AlertScanResult, UserProfile } from "@orion/types";
import { useAlertsStore } from "../../stores/alerts.store.js";
import { useAutomationOverview, useAutonomyCore } from "../../hooks/useAutomations.js";
import {
  useApproveDecision,
  useDecisions,
  useDismissDecision,
  useSyncDecisions,
} from "../../hooks/useDecisions.js";

interface MissionControlPanelProps {
  profile: UserProfile;
  onSendToChat: (text: string) => void;
}

function statusColor(status: string): string {
  if (status === "executed" || status === "success" || status === "confirmed") return "#10B981";
  if (status === "blocked" || status === "failed") return "#EF4444";
  if (status === "decision" || status === "pending") return "#F59E0B";
  return "#00D4FF";
}

function priorityColor(priority: string): string {
  if (priority === "critical" || priority === "high") return "#EF4444";
  if (priority === "medium") return "#F59E0B";
  return "#10B981";
}

export function MissionControlPanel({ profile, onSendToChat }: MissionControlPanelProps): JSX.Element {
  const c = profile.theme.primary;
  const c2 = profile.theme.secondary;
  const alerts = useAlertsStore((s) => s.alerts);
  const scanAlerts = useAlertsStore((s) => s.scan);
  const refetchAlerts = useAlertsStore((s) => s.fetch);
  const { data: overview, refetch: refetchOverview } = useAutomationOverview();
  const { data: autonomyCore, refetch: refetchAutonomy } = useAutonomyCore();
  const { data: decisions, refetch: refetchDecisions } = useDecisions();
  const syncDecisions = useSyncDecisions();
  const approveDecision = useApproveDecision();
  const dismissDecision = useDismissDecision();
  const [scanState, setScanState] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [lastScan, setLastScan] = useState<AlertScanResult | null>(null);

  const pendingDecisions = decisions ?? [];
  const recentActions = autonomyCore?.recentActions ?? [];
  const blocked = recentActions.filter((action) => action.status === "blocked").length;
  const executed = recentActions.filter((action) => action.status === "executed").length;
  const waiting = pendingDecisions.length + alerts.length;
  const signalLoad = alerts.length + pendingDecisions.length + blocked;
  const autonomyScore = overview?.autonomyScore ?? 0;

  const runPulse = async (): Promise<void> => {
    setScanState("running");
    const result = await scanAlerts();
    if (!result) {
      setScanState("err");
      setTimeout(() => setScanState("idle"), 3500);
      return;
    }
    setLastScan(result);
    await syncDecisions.mutateAsync();
    await Promise.all([refetchAlerts(), refetchDecisions(), refetchAutonomy(), refetchOverview()]);
    setScanState("ok");
    setTimeout(() => setScanState("idle"), 3500);
  };

  const approve = async (id: string): Promise<void> => {
    const result = await approveDecision.mutateAsync(id);
    await Promise.all([refetchAlerts(), refetchDecisions(), refetchAutonomy(), refetchOverview()]);
    if (result.executed && result.execution) {
      onSendToChat(`Acao executada: ${result.execution.summary}`);
      return;
    }
    onSendToChat(result.action);
  };

  return (
    <div className="mission-control">
      <section className="mission-hero">
        <div className="mission-core" style={{ borderColor: `${c}35` }}>
          <div>
            <div className="hud-label" style={{ color: c }}>MISSION CONTROL</div>
            <h2>Orion Operational Command</h2>
            <p>
              Visao unica do que o sistema percebeu, decidiu, executou e bloqueou. O objetivo aqui e confianca operacional:
              autonomia visivel, auditavel e sob seu comando.
            </p>
          </div>
          <button
            className="orion-command mission-primary"
            onClick={() => void runPulse()}
            disabled={scanState === "running"}
            style={{ color: c, borderColor: `${c}55`, background: `${c}12` }}
          >
            {scanState === "running" ? "VARRENDO..." : scanState === "ok" ? "PULSE OK" : scanState === "err" ? "FALHOU" : "RODAR PROACTIVE PULSE"}
          </button>
        </div>
        {[
          ["Autonomia", autonomyScore, "score operacional", autonomyScore >= 70 ? "#10B981" : autonomyScore >= 40 ? "#F59E0B" : "#EF4444"],
          ["Aguardando", waiting, "alertas + decisoes", waiting > 0 ? "#F59E0B" : "#10B981"],
          ["Executadas", executed, "acoes recentes", "#10B981"],
          ["Bloqueadas", blocked, "por politica", blocked > 0 ? "#EF4444" : c2],
        ].map(([label, value, sub, color]) => (
          <div key={String(label)} className="mission-metric" style={{ borderColor: `${String(color)}30` }}>
            <span className="hud-label" style={{ color: String(color) }}>{label}</span>
            <strong style={{ color: String(color) }}>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </section>

      {lastScan && (
        <section className="mission-scan-strip">
          <span>SCAN</span>
          <strong>{lastScan.detection.checked}</strong> sinais checados
          <strong>{lastScan.detection.created}</strong> alertas
          <strong>{lastScan.pulse.routed}</strong> missoes roteadas
          <strong>{lastScan.pulse.skipped}</strong> dedupes
        </section>
      )}

      <section className="mission-grid">
        <article className="mission-panel">
          <div className="mission-panel-head">
            <div>
              <div className="hud-label" style={{ color: c }}>SINAIS DETECTADOS</div>
              <p>Alertas ativos que podem virar decisao ou conversa.</p>
            </div>
            <span>{alerts.length}</span>
          </div>
          <div className="mission-list">
            {alerts.length === 0 ? (
              <div className="mission-empty">Nenhum alerta ativo.</div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="mission-row">
                  <i style={{ background: priorityColor(alert.priority) }} />
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{alert.module.toUpperCase()} · {alert.priority}</small>
                    <p>{alert.text}</p>
                  </div>
                  <button className="orion-command" onClick={() => onSendToChat(alert.action)}>ABRIR</button>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="mission-panel">
          <div className="mission-panel-head">
            <div>
              <div className="hud-label" style={{ color: "#F59E0B" }}>DECISOES PENDENTES</div>
              <p>Acoes preparadas, aguardando aprovacao humana.</p>
            </div>
            <span>{pendingDecisions.length}</span>
          </div>
          <div className="mission-list">
            {pendingDecisions.length === 0 ? (
              <div className="mission-empty">Decision Inbox limpa.</div>
            ) : (
              pendingDecisions.slice(0, 5).map((decision) => (
                <div key={decision.id} className="mission-row">
                  <i style={{ background: priorityColor(decision.priority) }} />
                  <div>
                    <strong>{decision.title}</strong>
                    <small>{decision.source.toUpperCase()} · {decision.priority}</small>
                    <p>{decision.summary}</p>
                  </div>
                  <div className="mission-actions">
                    <button className="orion-command" onClick={() => void approve(decision.id)}>OK</button>
                    <button className="orion-command" onClick={() => dismissDecision.mutate(decision.id)}>IGN</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="mission-grid lower">
        <article className="mission-panel mission-wide">
          <div className="mission-panel-head">
            <div>
              <div className="hud-label" style={{ color: c2 }}>AUDITORIA DE AUTONOMIA</div>
              <p>O que o Orion executou, bloqueou ou moveu para aprovacao.</p>
            </div>
            <span>{recentActions.length}</span>
          </div>
          <div className="mission-timeline">
            {recentActions.length === 0 ? (
              <div className="mission-empty">Ainda sem eventos auditados. Rode o Proactive Pulse ou acione o chat executor.</div>
            ) : (
              recentActions.slice(0, 10).map((action) => {
                const color = statusColor(action.status);
                return (
                  <div key={action.id} className="mission-timeline-row">
                    <span style={{ borderColor: color, background: `${color}25` }} />
                    <div>
                      <strong>{action.title}</strong>
                      <small>
                        {action.moduleId.toUpperCase()} · {action.status} · {new Date(action.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      {action.reason && <p>{action.reason}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="mission-panel">
          <div className="mission-panel-head">
            <div>
              <div className="hud-label" style={{ color: "#10B981" }}>POSTURA</div>
              <p>Resumo do estado operacional atual.</p>
            </div>
          </div>
          <div className="mission-readout">
            <div>
              <span>Automacoes</span>
              <strong>{overview?.enabled ?? 0}/{overview?.total ?? 0}</strong>
            </div>
            <div>
              <span>Falhas 24h</span>
              <strong>{overview?.failedLast24h ?? 0}</strong>
            </div>
            <div>
              <span>Modulos executam</span>
              <strong>{autonomyCore?.modulesExecutable ?? 0}</strong>
            </div>
            <div>
              <span>Exigem OK</span>
              <strong>{autonomyCore?.confirmationRequired ?? 0}</strong>
            </div>
          </div>
          <button
            className="orion-command mission-secondary"
            onClick={() =>
              onSendToChat(
                `Analise meu Mission Control agora. Tenho ${signalLoad} sinais operacionais, ${pendingDecisions.length} decisoes e ${blocked} bloqueios recentes. Diga o que devo aprovar, ignorar ou ajustar.`,
              )
            }
            style={{ color: c, borderColor: `${c}45`, background: `${c}10` }}
          >
            PEDIR ANALISE AO ORION
          </button>
        </article>
      </section>
    </div>
  );
}
