import type { ProactiveAlert } from "@orion/types";

interface AlertCardProps {
  alert: ProactiveAlert;
  onApprove: () => void;
  onDismiss: () => void;
}

export function AlertCard({ alert, onApprove, onDismiss }: AlertCardProps): JSX.Element {
  return (
    <div
      style={{
        padding: "11px 13px",
        marginBottom: 7,
        background: `linear-gradient(135deg, ${alert.color}10, transparent)`,
        border: `1px solid ${alert.color}28`,
        borderRadius: 8,
        animation: "fadeUp 0.3s ease",
      }}
    >
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <span style={{ fontSize: 15, color: alert.color, marginTop: 1 }}>{alert.icon}</span>
        <div style={{ flex: 1 }}>
          <div className="hud-label" style={{ fontSize: 10, color: alert.color, marginBottom: 3 }}>
            {alert.title}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.44)", lineHeight: 1.5, marginBottom: 8 }}>
            {alert.text}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button
              onClick={onApprove}
              className="hud-label"
              style={{
                padding: "3px 9px",
                fontSize: 9,
                background: `${alert.color}18`,
                border: `1px solid ${alert.color}45`,
                color: alert.color,
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              ATIVAR
            </button>
            <button
              onClick={onDismiss}
              style={{
                padding: "3px 9px",
                fontSize: 9,
                fontFamily: "'Share Tech Mono', monospace",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.19)",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
