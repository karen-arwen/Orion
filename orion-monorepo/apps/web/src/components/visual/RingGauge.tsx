/* ═══════════════════════════════════════════════════════════════════
   RingGauge — anel SVG com valor central. Estética HUD com glow.

   Usado em: dashboards de modulos pra mostrar score/percentual com
   peso visual maior do que numero solto. Suporta gradiente, label e
   sublabel embaixo.
═══════════════════════════════════════════════════════════════════ */

interface RingGaugeProps {
  /** Valor 0-100. */
  value: number;
  /** Label principal exibido dentro do anel (default: o proprio valor). */
  centerLabel?: string;
  /** Label pequeno acima do valor central. */
  topLabel?: string;
  /** Label abaixo do anel. */
  bottomLabel?: string;
  /** Cor principal do anel (default: ciano). */
  color?: string;
  /** Tamanho do svg em px (largura = altura). Default 110. */
  size?: number;
  /** Espessura do anel. Default 7. */
  thickness?: number;
}

export function RingGauge({
  value,
  centerLabel,
  topLabel,
  bottomLabel,
  color = "#00D4FF",
  size = 110,
  thickness = 7,
}: RingGaugeProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const center = size / 2;
  const gradientId = `ring-grad-${color.replace("#", "")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.45" />
            </linearGradient>
          </defs>
          {/* Trilha de fundo */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.045)"
            strokeWidth={thickness}
          />
          {/* Anel preenchido */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.4, 0.0, 0.2, 1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {topLabel && (
            <span
              className="hud-label"
              style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: "0.18em" }}
            >
              {topLabel}
            </span>
          )}
          <strong
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: size * 0.26,
              color,
              lineHeight: 1,
              textShadow: `0 0 10px ${color}66`,
            }}
          >
            {centerLabel ?? Math.round(clamped)}
          </strong>
        </div>
      </div>
      {bottomLabel && (
        <span
          className="hud-label"
          style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em" }}
        >
          {bottomLabel}
        </span>
      )}
    </div>
  );
}
