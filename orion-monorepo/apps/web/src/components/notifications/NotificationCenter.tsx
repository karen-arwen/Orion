import { DiffViewer } from "../visual/DiffViewer.js";
import { useState } from "react";
import type { AlertScanResult, DecisionApproveResult, DecisionItem, ProactiveAlert } from "@orion/types";
import { AlertCard } from "../panels/AlertCard.js";

interface NotificationCenterProps {
  open: boolean;
  color: string;
  alerts: ProactiveAlert[];
  decisions: DecisionItem[];
  executedDecisions: DecisionItem[];
  onApprove: (alert: ProactiveAlert) => void;
  onDismiss: (alert: ProactiveAlert) => void;
  onApproveDecision: (decision: DecisionItem) => Promise<DecisionApproveResult> | void;
  onDismissDecision: (decision: DecisionItem) => void;
  onClose: () => void;
  onRefresh: () => Promise<AlertScanResult | null>;
}

function externalPreview(decision: DecisionItem): {
  provider: string;
  destination?: string;
  body?: string;
  risk?: string;
} | null {
  const externalAction = decision.payload.externalAction;
  if (!externalAction || typeof externalAction !== "object" || Array.isArray(externalAction)) return null;
  const preview = (externalAction as Record<string, unknown>).preview;
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null;
  const row = preview as Record<string, unknown>;
  return {
    provider: typeof row.provider === "string" ? row.provider : "external",
    destination: typeof row.destination === "string" ? row.destination : undefined,
    body: typeof row.body === "string" ? row.body : undefined,
    risk: typeof row.risk === "string" ? row.risk : undefined,
  };
}

export function NotificationCenter({
  open,
  color,
  alerts,
  decisions,
  executedDecisions,
  onApprove,
  onDismiss,
  onApproveDecision,
  onDismissDecision,
  onClose,
  onRefresh,
}: NotificationCenterProps): JSX.Element | null {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<AlertScanResult | null>(null);
  const [executionResults, setExecutionResults] = useState<DecisionApproveResult[]>([]);

  if (!open) return null;

  const criticalAlerts = alerts.filter((a) => a.priority === "critical" || a.priority === "high").length;
  const criticalDecisions = decisions.filter((d) => d.priority === "critical" || d.priority === "high").length;
  const critical = criticalAlerts + criticalDecisions;
  const pending = alerts.length + decisions.length;

  return (
    <div className="orion-overlay notification-overlay" onMouseDown={onClose}>
      <aside className="notification-center" onMouseDown={(e) => e.stopPropagation()} style={{ borderColor: `${color}35` }}>
        <div className="notification-header">
          <div>
            <div className="hud-label" style={{ color, fontSize: 11 }}>NOTIFICATION CENTER</div>
            <p>{pending} pendentes · {critical} críticos/altos</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="orion-command"
              onClick={() => {
                setScanning(true);
                void onRefresh().then((result) => {
                  setLastScan(result);
                  setScanning(false);
                });
              }}
              style={{ color, borderColor: `${color}45`, background: `${color}10` }}
            >
              {scanning ? "SCAN" : "SYNC"}
            </button>
            <button className="orion-command" onClick={onClose}>FECHAR</button>
          </div>
        </div>

        <div className="notification-summary">
          <div>
            <span className="hud-label" style={{ color }}>Action Queue</span>
            <strong>{decisions.length ? `${decisions.length} ações` : alerts.length ? "alertas ativos" : "sem bloqueios"}</strong>
          </div>
          <div>
            <span className="hud-label" style={{ color: "#F59E0B" }}>Prioridade</span>
            <strong>{critical > 0 ? `${critical} atenção` : "normal"}</strong>
          </div>
        </div>

        {lastScan && (
          <div className="notification-scan-result">
            Varredura: {lastScan.detection.checked} sinais · {lastScan.detection.created} alerta(s) · {lastScan.pulse.routed} missão(ões)
          </div>
        )}

        {executionResults.slice(0, 3).map((result) => (
          <div key={result.id} className="decision-execution-result">
            <span>{result.execution?.label ?? "Acao aprovada"}</span>
            <pre>{result.execution?.summary ?? result.action}</pre>
          </div>
        ))}

        {executedDecisions.length > 0 && (
          <div className="notification-history">
            <span className="hud-label" style={{ color }}>EXECUTION HISTORY</span>
            {executedDecisions.slice(0, 5).map((decision) => (
              <ExecutionHistoryRow key={decision.id} decision={decision} />
            ))}
          </div>
        )}

        <div className="notification-list">
          {pending === 0 ? (
            <div className="notification-empty">
              <span className="hud-label" style={{ color }}>SISTEMA SILENCIOSO</span>
              <p>Nenhuma decisão pendente. O Orion continua monitorando contexto, agenda e automações.</p>
            </div>
          ) : (
            <>
              {decisions.map((decision) => (
                <DecisionPreviewCard
                  key={decision.id}
                  decision={decision}
                  color={color}
                  onApproveDecision={onApproveDecision}
                  onDismissDecision={onDismissDecision}
                  onExecution={(result) => setExecutionResults((current) => [result, ...current].slice(0, 5))}
                />
              ))}
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onApprove={() => {
                    onApprove(alert);
                    onClose();
                  }}
                  onDismiss={() => onDismiss(alert)}
                />
              ))}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function ExecutionHistoryRow({ decision }: { decision: DecisionItem }): JSX.Element {
  const execution =
    decision.payload.execution && typeof decision.payload.execution === "object" && !Array.isArray(decision.payload.execution)
      ? (decision.payload.execution as Record<string, unknown>)
      : null;
  const label = typeof execution?.label === "string" ? execution.label : decision.title;
  const summary = typeof execution?.summary === "string" ? execution.summary : decision.proposedAction;
  return (
    <div className="notification-history-row">
      <strong>{label}</strong>
      <small>{new Date(decision.updatedAt).toLocaleString("pt-BR")}</small>
      <pre>{summary}</pre>
    </div>
  );
}

function DecisionPreviewCard({
  decision,
  color,
  onApproveDecision,
  onDismissDecision,
  onExecution,
}: {
  decision: DecisionItem;
  color: string;
  onApproveDecision: (decision: DecisionItem) => Promise<DecisionApproveResult> | void;
  onDismissDecision: (decision: DecisionItem) => void;
  onExecution: (result: DecisionApproveResult) => void;
}): JSX.Element {
  const preview = externalPreview(decision);
  const [execution, setExecution] = useState<DecisionApproveResult | null>(null);
  const [running, setRunning] = useState(false);
  return (
    <article className="decision-card notification-decision" style={{ borderColor: `${color}35` }}>
      <div>
        <span className="hud-label" style={{ color }}>
          {decision.source.toUpperCase()} · {decision.priority.toUpperCase()}
          {preview ? ` · ${preview.provider.toUpperCase()}` : ""}
        </span>
        <strong>{decision.title}</strong>
        <p>{decision.summary}</p>
        {preview && (
          <div className="external-preview">
            <span>{preview.destination ? `Destino: ${preview.destination}` : "Destino externo"}</span>
            {preview.risk && <span>Risco: {preview.risk}</span>}
            {preview.body && (
              preview.provider === "workspace" || preview.body.includes("SEARCH") || preview.body.includes("+++") || preview.body.includes("---")
                ? <DiffViewer content={preview.body} />
                : <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "6px 0 0", maxHeight: 200, overflow: "auto" }}>{preview.body}</pre>
            )}
          </div>
        )}
        <small>{decision.proposedAction}</small>
      </div>
      <div className="decision-card-actions">
        <button
          onClick={() => {
            setRunning(true);
            Promise.resolve(onApproveDecision(decision))
              .then((result) => {
                if (result) {
                  setExecution(result);
                  onExecution(result);
                }
              })
              .finally(() => setRunning(false));
          }}
          className="orion-command"
          disabled={running}
          style={{ color, borderColor: `${color}45`, background: `${color}10` }}
        >
          {running ? "EXECUTANDO" : "EXECUTAR"}
        </button>
        <button onClick={() => onDismissDecision(decision)} className="orion-command">
          IGNORAR
        </button>
      </div>
      {execution?.execution && (
        <div className="decision-execution-result">
          <span>{execution.execution.label}</span>
          <pre>{execution.execution.summary}</pre>
        </div>
      )}
    </article>
  );
}
