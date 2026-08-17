/* ═══════════════════════════════════════════════════════════════════
   TagPill — chip pequeno com cor e label. Substitui spans inline com
   hud-label espalhados pelas paginas.
═══════════════════════════════════════════════════════════════════ */

interface TagPillProps {
  label: string;
  color?: string;
  /** Variante visual. `solid` = preenchimento; `outline` = so borda. */
  variant?: "solid" | "outline";
  /** Tamanho. */
  size?: "xs" | "sm" | "md";
  /** Icone unicode opcional antes do label. */
  icon?: string;
  /** Click handler — torna o pill um botao. */
  onClick?: () => void;
  /** Marca como "ativo" (mais brilho). */
  active?: boolean;
}

export function TagPill({
  label,
  color = "#00D4FF",
  variant = "outline",
  size = "sm",
  icon,
  onClick,
  active = false,
}: TagPillProps): JSX.Element {
  const padY = size === "md" ? 4 : size === "sm" ? 2 : 1;
  const padX = size === "md" ? 9 : size === "sm" ? 6 : 5;
  const fontSize = size === "md" ? 10 : size === "sm" ? 8 : 7;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: `${padY}px ${padX}px`,
    fontSize,
    letterSpacing: "0.18em",
    fontFamily: "'Share Tech Mono', monospace",
    textTransform: "uppercase",
    borderRadius: 3,
    border: `1px solid ${color}${active ? "AA" : "55"}`,
    color,
    background: variant === "solid" ? `${color}${active ? "30" : "18"}` : "transparent",
    boxShadow: active ? `0 0 6px ${color}55` : "none",
    cursor: onClick ? "pointer" : "default",
    transition: "all 180ms ease",
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...baseStyle, outline: "none" }}>
        {icon && <span>{icon}</span>}
        {label}
      </button>
    );
  }

  return (
    <span style={baseStyle}>
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}
