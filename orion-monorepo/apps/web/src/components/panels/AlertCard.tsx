import type { ProactiveAlert, AlertPriority } from "@orion/types";

interface AlertCardProps {
  alert: ProactiveAlert;
  onApprove: () => void;
  onDismiss: () => void;
}

type PriorityMeta = { label: string; glow: string };
const PRIORITY_META: Record<AlertPriority, PriorityMeta> = {
  low: { label: "LOW", glow: "" },
  medium: { label: "MED", glow: "" },
  high: { label: "HIGH", glow: " · pulse" },
  critical: { label: "CRIT", glow: " · pulse" },
};
const DEFAULT_META: PriorityMeta = { label: "MED", glow: "" };

export function AlertCard({ alert, onApprove, onDismiss }: AlertCardProps): JSX.Element {
  const meta: PriorityMeta = PRIORITY_META[alert.priority] ?? DEFAULT_META;
  const isHigh = alert.priority === "high" || alert.priority === "critical";

  return (
    <div
      style={{
        padding: "11px 13px",
        marginBottom: 7,
        background: `linear-gradient(135deg, ${alert.color}${isHigh ? "1a" : "10"}, transparent)`,
        border: `1px solid ${alert.color}${isHigh ? "55" : "28"}`,
        borderLeft: `3px solid ${alert.color}`,
        borderRadius: 8,
        boxShadow: isHigh ? `0 0 14px ${alert.color}22` : "none",
        animation: "fadeUp 0.3s ease",
      }}
    >
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <span
          style={{
            fontSize: 15,
            color: alert.color,
            marginTop: 1,
            filter: isHigh ? `drop-shadow(0 0 6px ${alert.color})` : "none",
          }}
        >
          {alert.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 3,
            }}
          >
            <span
              className="hud-label"
              style={{
                fontSize: 7,
                padding: "1px 5px",
                background: `${alert.color}20`,
                border: `1px solid ${alert.color}40`,
                color: alert.color,
                borderRadius: 3,
              }}
            >
              {meta.label}
            </span>
            <span
              className="hud-label"
              style={{ fontSize: 10, color: alert.color, flex: 1, minWidth: 0 }}
            >
              {alert.title}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
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
