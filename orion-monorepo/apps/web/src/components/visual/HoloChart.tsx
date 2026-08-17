/* ═══════════════════════════════════════════════════════════════════
   HoloChart — sparkline SVG estilo HUD com area gradient + line glow.
   Util pra mostrar tendencias (sono, gastos, energia) sem chart library.
═══════════════════════════════════════════════════════════════════ */

interface HoloChartProps {
  /** Serie de pontos (qualquer escala — normalizado internamente). */
  points: number[];
  /** Labels opcionais sob cada ponto (ex: ["S","T","Q","Q","S","S","D"]). */
  labels?: string[];
  /** Cor principal. */
  color?: string;
  /** Largura em px. Default 280. */
  width?: number;
  /** Altura em px. Default 80. */
  height?: number;
  /** Mostra valor numerico no ultimo ponto. */
  showLastValue?: boolean;
  /** Sufixo do valor (ex: "h", "%"). */
  suffix?: string;
}

export function HoloChart({
  points,
  labels,
  color = "#00D4FF",
  width = 280,
  height = 80,
  showLastValue = false,
  suffix = "",
}: HoloChartProps): JSX.Element {
  const padding = 10;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const safePoints = points.length > 0 ? points : [0, 0];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints);
  const range = max - min || 1;
  const stepX = safePoints.length > 1 ? usableW / (safePoints.length - 1) : 0;

  const coords = safePoints.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - (v - min) / range) * usableH;
    return { x, y, v };
  });
  const last = coords[coords.length - 1] ?? { x: 0, y: 0, v: 0 };

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${last.x.toFixed(1)},${height - padding} L${padding},${height - padding} Z`;

  const gradientId = `holo-grad-${color.replace("#", "")}`;

  return (
    <div style={{ width, position: "relative" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Linhas de grade horizontais (4) */}
        {[0, 0.33, 0.66, 1].map((p) => (
          <line
            key={p}
            x1={padding}
            x2={width - padding}
            y1={padding + p * usableH}
            y2={padding + p * usableH}
            stroke="rgba(255,255,255,0.04)"
            strokeDasharray="2 4"
          />
        ))}
        {/* Area sob a curva */}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        {/* Linha */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 3px ${color}AA)` }}
        />
        {/* Pontos */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3 : 1.5}
            fill={color}
            style={i === coords.length - 1 ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
          />
        ))}
      </svg>
      {labels && labels.length === safePoints.length && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: `0 ${padding}px`,
            marginTop: 2,
          }}
        >
          {labels.map((l, i) => (
            <span
              key={`${l}-${i}`}
              className="hud-label"
              style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}
            >
              {l}
            </span>
          ))}
        </div>
      )}
      {showLastValue && (
        <div
          style={{
            position: "absolute",
            top: padding,
            right: padding,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 13,
            color,
            textShadow: `0 0 6px ${color}80`,
          }}
        >
          {last.v}{suffix}
        </div>
      )}
    </div>
  );
}
