interface NeuralRingProps {
  color: string;
  size?: number;
}

/**
 * Logo animado: 3 anéis concêntricos rotacionando + nós em hexágono + core.
 */
export function NeuralRing({ color, size = 120 }: NeuralRingProps): JSX.Element {
  const half = size / 2;
  const angles = [0, 60, 120, 180, 240, 300] as const;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <circle
          cx={half}
          cy={half}
          r={half - 4}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.12}
          strokeDasharray="4 8"
          style={{ animation: "spin 30s linear infinite", transformOrigin: "center" }}
        />
        <circle
          cx={half}
          cy={half}
          r={half - 14}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.25}
          strokeDasharray="2 6"
          style={{ animation: "spinR 20s linear infinite", transformOrigin: "center" }}
        />
        <circle cx={half} cy={half} r={half - 24} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
        <circle
          cx={half}
          cy={half}
          r={6}
          fill={color}
          opacity={0.9}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
        {angles.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const r = half - 4;
          const x = half + r * Math.cos(rad);
          const y = half + r * Math.sin(rad);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.5}
              fill={color}
              opacity={0.6}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          );
        })}
      </svg>
    </div>
  );
}
