import { type CSSProperties } from "react";

interface SkeletonProps {
  /** Largura (CSS value). Default: "100%" */
  width?: string | number;
  /** Altura (CSS value). Default: 16 */
  height?: string | number;
  /** Border radius. Default: 6 */
  radius?: number;
  /** Variante visual */
  variant?: "line" | "circle" | "card" | "chart";
  /** Repetir N vezes (para listas) */
  count?: number;
  /** Gap entre itens repetidos */
  gap?: number;
  /** className adicional */
  className?: string;
}

const pulseKeyframes = `
@keyframes hud-skeleton-pulse {
  0% { opacity: 0.15; }
  50% { opacity: 0.35; }
  100% { opacity: 0.15; }
}
@keyframes hud-skeleton-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;

// Injetar keyframes uma vez
let stylesInjected = false;
function ensureStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
  stylesInjected = true;
}

const baseStyle: CSSProperties = {
  background: "rgba(0, 212, 255, 0.08)",
  position: "relative",
  overflow: "hidden",
  animation: "hud-skeleton-pulse 2s ease-in-out infinite",
};

const sweepStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.06), transparent)",
  animation: "hud-skeleton-sweep 1.8s ease-in-out infinite",
};

/**
 * Skeleton loading HUD-style do ORION.
 * Usa a paleta cyan com animação de sweep sutil.
 */
export function HudSkeleton({
  width = "100%",
  height = 16,
  radius = 6,
  variant = "line",
  count = 1,
  gap = 10,
  className,
}: SkeletonProps): JSX.Element {
  ensureStyles();

  if (variant === "circle") {
    const size = typeof height === "number" ? height : 40;
    return (
      <div
        className={className}
        style={{ ...baseStyle, width: size, height: size, borderRadius: "50%" }}
      >
        <div style={sweepStyle} />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={className}
        style={{
          border: "1px solid rgba(0, 212, 255, 0.1)",
          borderRadius: 10,
          padding: "16px 20px",
          background: "rgba(0, 212, 255, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <HudSkeleton variant="circle" height={36} />
          <div style={{ flex: 1 }}>
            <HudSkeleton width="60%" height={14} />
            <div style={{ height: 8 }} />
            <HudSkeleton width="40%" height={10} />
          </div>
        </div>
        <HudSkeleton height={12} />
        <div style={{ height: 8 }} />
        <HudSkeleton width="85%" height={12} />
        <div style={{ height: 8 }} />
        <HudSkeleton width="70%" height={12} />
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div
        className={className}
        style={{
          border: "1px solid rgba(0, 212, 255, 0.1)",
          borderRadius: 10,
          padding: "20px",
          background: "rgba(0, 212, 255, 0.02)",
        }}
      >
        <HudSkeleton width="30%" height={14} />
        <div style={{ height: 16 }} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
          {[65, 80, 45, 90, 60, 75, 50].map((h, i) => (
            <div
              key={i}
              style={{
                ...baseStyle,
                flex: 1,
                height: `${h}%`,
                borderRadius: "4px 4px 0 0",
                animationDelay: `${i * 0.15}s`,
              }}
            >
              <div style={sweepStyle} />
            </div>
          ))}
        </div>
        <div style={{ height: 12 }} />
        <HudSkeleton width="100%" height={1} />
      </div>
    );
  }

  // variant === "line" (default)
  const items = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={className}
      style={{
        ...baseStyle,
        width,
        height,
        borderRadius: radius,
        animationDelay: `${i * 0.1}s`,
      }}
    >
      <div style={sweepStyle} />
    </div>
  ));

  if (count === 1) return items[0]!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {items}
    </div>
  );
}

/**
 * Skeleton pré-montado para páginas de módulo.
 * Header + stats + lista de itens.
 */
export function ModuleSkeleton(): JSX.Element {
  ensureStyles();
  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <HudSkeleton width="45%" height={22} />
        <div style={{ height: 10 }} />
        <HudSkeleton width="65%" height={13} />
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid rgba(0, 212, 255, 0.1)",
              borderRadius: 10,
              padding: 16,
              background: "rgba(0, 212, 255, 0.02)",
            }}
          >
            <HudSkeleton width="50%" height={11} />
            <div style={{ height: 10 }} />
            <HudSkeleton width="40%" height={20} />
          </div>
        ))}
      </div>

      {/* List items */}
      <HudSkeleton variant="card" />
      <div style={{ height: 12 }} />
      <HudSkeleton variant="card" />
      <div style={{ height: 12 }} />
      <HudSkeleton variant="card" />
    </div>
  );
}
