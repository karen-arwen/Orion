/* ═══════════════════════════════════════════════════════════════════
   NeonBar — barra horizontal com glow, label, valor e (opcional) trilha
   acumulada. Substitui as <div><i width=N%/></div> espalhadas pelo app.
═══════════════════════════════════════════════════════════════════ */

interface NeonBarProps {
  label: string;
  /** Valor atual (0-100 ou comparativo com max). */
  value: number;
  /** Valor maximo possivel. Se omitido, value e tratado como pct. */
  max?: number;
  /** Cor principal. */
  color?: string;
  /** Texto opcional a direita (ex: "R$ 320 / R$ 1.000"). */
  hint?: string;
  /** Mostra um marcador secundario (ex: media historica) em pct. */
  marker?: number;
  /** Tamanho do texto/altura. Default "md". */
  size?: "sm" | "md" | "lg";
}

export function NeonBar({
  label,
  value,
  max,
  color = "#00D4FF",
  hint,
  marker,
  size = "md",
}: NeonBarProps): JSX.Element {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : Math.max(0, Math.min(100, value));
  const height = size === "lg" ? 10 : size === "sm" ? 4 : 6;
  const labelSize = size === "lg" ? 11 : size === "sm" ? 8 : 9;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span
          className="hud-label"
          style={{ fontSize: labelSize, color: "rgba(255,255,255,0.55)", letterSpacing: "0.16em" }}
        >
          {label}
        </span>
        {hint && (
          <span
            style={{
              fontSize: labelSize,
              color,
              fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: "0.04em",
            }}
          >
            {hint}
          </span>
        )}
      </div>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: height / 2,
          background: "rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88 0%, ${color} 70%, ${color}DD 100%)`,
            boxShadow: `0 0 8px ${color}66, inset 0 0 4px ${color}AA`,
            transition: "width 500ms cubic-bezier(0.4, 0.0, 0.2, 1)",
            borderRadius: height / 2,
          }}
        />
        {typeof marker === "number" && marker >= 0 && marker <= 100 && (
          <div
            title={`marker: ${marker}%`}
            style={{
              position: "absolute",
              top: -2,
              bottom: -2,
              left: `${marker}%`,
              width: 2,
              background: "rgba(255,255,255,0.6)",
              boxShadow: "0 0 4px rgba(255,255,255,0.5)",
            }}
          />
        )}
      </div>
    </div>
  );
}
