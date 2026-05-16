import type { OrionMode, ProactiveAlert, Project, UserProfile } from "@orion/types";
import { AlertCard } from "./AlertCard.js";

interface RightRailProps {
  profile: UserProfile;
  mode: OrionMode;
  alerts: ProactiveAlert[];
  projects: Project[];
  onAlertApprove: (a: ProactiveAlert) => void;
  onAlertDismiss: (a: ProactiveAlert) => void;
  connectedProviders: string[];
}

const MODE_COLORS: Record<OrionMode, string> = {
  SILENCIOSO: "#64748B",
  NORMAL: "#00D4FF",
  STARK: "#F59E0B",
};

export function RightRail({
  profile,
  mode,
  alerts,
  projects,
  onAlertApprove,
  onAlertDismiss,
  connectedProviders,
}: RightRailProps): JSX.Element {
  const color = profile.theme.primary;

  const statusRows: Array<{ label: string; state: string; color: string }> = [
    { label: "Núcleo IA", state: "ONLINE", color: "#10B981" },
    { label: "Gmail MCP", state: connectedProviders.includes("gmail") ? "CONECTADO" : "OFF", color: connectedProviders.includes("gmail") ? "#10B981" : "#64748B" },
    { label: "Calendar MCP", state: connectedProviders.includes("gcal") ? "CONECTADO" : "OFF", color: connectedProviders.includes("gcal") ? "#10B981" : "#64748B" },
    { label: "Drive MCP", state: connectedProviders.includes("gdrive") ? "CONECTADO" : "OFF", color: connectedProviders.includes("gdrive") ? "#10B981" : "#64748B" },
    { label: "Memória", state: "ATIVA", color: "#10B981" },
    { label: "Modo", state: mode, color: MODE_COLORS[mode] },
  ];

  return (
    <div
      style={{
        borderLeft: `1px solid ${color}12`,
        overflowY: "auto",
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "linear-gradient(180deg, rgba(255,255,255,0.01), transparent)",
      }}
    >
      <div>
        <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.13)", marginBottom: 10 }}>
          ALERTAS PROATIVOS · {alerts.length}
        </div>
        {alerts.length === 0 ? (
          <div
            className="hud-label"
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.13)",
              textAlign: "center",
              padding: 16,
              lineHeight: 1.8,
            }}
          >
            Sistema silencioso.
            <br />
            Nenhum alerta pendente.
          </div>
        ) : (
          alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onApprove={() => onAlertApprove(a)}
              onDismiss={() => onAlertDismiss(a)}
            />
          ))
        )}
      </div>

      <div>
        <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.13)", marginBottom: 8 }}>
          STATUS
        </div>
        {statusRows.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.02)",
            }}
          >
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.21)" }}>{s.label}</span>
            <span
              className="hud-label"
              style={{ fontSize: 8, color: s.color, textShadow: `0 0 6px ${s.color}40` }}
            >
              {s.state}
            </span>
          </div>
        ))}
      </div>

      <div>
        <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.13)", marginBottom: 10 }}>
          PROJETOS
        </div>
        {projects.length === 0 ? (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>—</div>
        ) : (
          projects.map((p) => (
            <div key={p.id} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.66)" }}>{p.name}</span>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.15)" }}>{p.progress}%</span>
              </div>
              <div style={{ height: 2.5, background: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
                <div
                  style={{
                    width: `${p.progress}%`,
                    height: "100%",
                    background: p.color,
                    borderRadius: 2,
                    boxShadow: `0 0 5px ${p.color}50`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div
        className="hud-label"
        style={{
          marginTop: "auto",
          textAlign: "center",
          padding: "10px 0",
          borderTop: "1px solid rgba(255,255,255,0.02)",
          fontSize: 8,
          color: "rgba(255,255,255,0.07)",
          lineHeight: 2,
        }}
      >
        O.R.I.O.N v2.0 · SaaS READY
        <br />
        MODO {mode}
        <br />
        <span style={{ color: `${color}25` }}>© by Karen Arwen</span>
      </div>
    </div>
  );
}
