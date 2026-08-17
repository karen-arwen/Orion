/* ═══════════════════════════════════════════════════════════════════
   TimelineRail — trilho vertical com nodes coloridos pra eventos
   sequenciais. Usado em: roteiros de viagem (dia 1/2/3), receitas (passo
   1/2/3), sessoes de check-in, etc.
═══════════════════════════════════════════════════════════════════ */

export interface TimelineNode {
  id: string;
  /** Texto do badge (ex: "DIA 1", "PASSO 3", "08:00"). */
  badge: string;
  /** Titulo principal do node. */
  title: string;
  /** Conteudo livre — string simples ou JSX. */
  body?: React.ReactNode;
  /** Cor do node (override). */
  color?: string;
  /** Icone unicode opcional dentro do circulo. */
  icon?: string;
}

interface TimelineRailProps {
  nodes: TimelineNode[];
  /** Cor padrao (default ciano). */
  color?: string;
}

export function TimelineRail({ nodes, color = "#00D4FF" }: TimelineRailProps): JSX.Element {
  return (
    <div style={{ position: "relative", paddingLeft: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Trilho vertical */}
      <div
        style={{
          position: "absolute",
          left: 11,
          top: 8,
          bottom: 8,
          width: 1,
          background: `linear-gradient(180deg, ${color}55, ${color}11)`,
        }}
      />
      {nodes.map((node, i) => {
        const c = node.color ?? color;
        return (
          <div
            key={node.id}
            style={{
              position: "relative",
              animation: `fadeUp 0.35s ease ${(i * 0.06).toFixed(2)}s both`,
            }}
          >
            {/* Node circular */}
            <div
              style={{
                position: "absolute",
                left: -28,
                top: 4,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#030509",
                border: `1.5px solid ${c}`,
                boxShadow: `0 0 10px ${c}55, inset 0 0 4px ${c}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 10,
                color: c,
                textShadow: `0 0 5px ${c}AA`,
              }}
            >
              {node.icon ?? String(i + 1).padStart(2, "0")}
            </div>
            {/* Conteudo */}
            <div
              style={{
                padding: "10px 14px",
                background: `linear-gradient(135deg, ${c}10, transparent 80%)`,
                border: `1px solid ${c}22`,
                borderLeft: `2px solid ${c}66`,
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  className="hud-label"
                  style={{
                    fontSize: 8,
                    color: c,
                    padding: "2px 6px",
                    border: `1px solid ${c}55`,
                    borderRadius: 3,
                    letterSpacing: "0.2em",
                  }}
                >
                  {node.badge}
                </span>
                <strong style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                  {node.title}
                </strong>
              </div>
              {node.body && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
                  {node.body}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
