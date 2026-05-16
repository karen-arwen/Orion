interface StatusDotProps {
  active?: boolean;
  color?: string;
  pulse?: boolean;
}

export function StatusDot({
  active = true,
  color = "#10B981",
  pulse = true,
}: StatusDotProps): JSX.Element {
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        background: active ? color : "rgba(255,255,255,0.08)",
        boxShadow: active && pulse ? `0 0 0 0 ${color}60` : "none",
        animation: active && pulse ? "ripple 2s ease-out infinite" : "none",
      }}
    />
  );
}
