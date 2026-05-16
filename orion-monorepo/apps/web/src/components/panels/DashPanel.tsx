import type { Project, UserProfile } from "@orion/types";

interface DashPanelProps {
  profile: UserProfile;
  projects: Project[];
}

interface Stat {
  label: string;
  value: string | number;
  sub: string;
  color: string;
}

export function DashPanel({ profile, projects }: DashPanelProps): JSX.Element {
  const c = profile.theme.primary;
  const c2 = profile.theme.secondary;
  const c3 = profile.theme.accent;

  const stats: Stat[] = [
    { label: "Projetos", value: projects.length, sub: "ativos", color: c },
    { label: "Módulos", value: "26", sub: "disponíveis", color: c2 },
    { label: "Automações", value: "4", sub: "ativas", color: c3 },
    { label: "Conectado", value: "Gmail", sub: "Calendar · Drive", color: "#10B981" },
    { label: "Uptime", value: "99.9%", sub: "este mês", color: c },
    { label: "IA Tokens", value: "∞", sub: "modo ilimitado", color: c2 },
  ];

  const fluxo = ["DETECTAR", "ANALISAR", "PRIORIZAR", "PROPOR", "CONFIRMAR", "EXECUTAR", "APRENDER"] as const;
  const dias = ["S", "T", "Q", "Q", "S", "S", "D"] as const;
  const heights = [55, 85, 40, 90, 30, 60, 20] as const;

  return (
    <div style={{ overflowY: "auto", padding: "20px 22px", flex: 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              padding: 14,
              background: "rgba(255,255,255,0.015)",
              border: `1px solid ${s.color}18`,
              borderRadius: 9,
              animation: `fadeUp ${0.1 + i * 0.05}s ease`,
            }}
          >
            <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.16)", marginBottom: 5 }}>
              {s.label}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: s.color,
                fontFamily: "'Share Tech Mono', monospace",
                textShadow: `0 0 16px ${s.color}40`,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: 18,
          background: "rgba(255,255,255,0.012)",
          border: "1px solid rgba(255,255,255,0.03)",
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.21)", marginBottom: 14 }}>
          ◈ PROJETOS
        </div>
        {projects.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Nenhum projeto. Crie um pra começar.</div>
        ) : (
          projects.map((p) => (
            <div key={p.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.66)", fontWeight: 600 }}>{p.name}</span>
                <span
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.18)",
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                >
                  {p.progress}% · {p.status}
                </span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
                <div
                  style={{
                    width: `${p.progress}%`,
                    height: "100%",
                    background: p.color,
                    borderRadius: 2,
                    boxShadow: `0 0 5px ${p.color}60`,
                    transition: "width 1.2s ease",
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: 18,
          background: `linear-gradient(135deg, ${c}06, transparent)`,
          border: `1px solid ${c}18`,
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div className="hud-label" style={{ fontSize: 10, color: c, marginBottom: 12 }}>
          ◉ FLUXO OPERACIONAL
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {fluxo.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                className="hud-label"
                style={{
                  padding: "4px 10px",
                  fontSize: 8,
                  background: i < 4 ? `${c}14` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${i < 4 ? c + "35" : "rgba(255,255,255,0.06)"}`,
                  color: i < 4 ? c : "rgba(255,255,255,0.15)",
                  borderRadius: 20,
                }}
              >
                {s}
              </div>
              {i < fluxo.length - 1 && <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 9 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 18,
          background: "rgba(255,255,255,0.012)",
          border: "1px solid rgba(255,255,255,0.03)",
          borderRadius: 10,
        }}
      >
        <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.21)", marginBottom: 14 }}>
          ◎ ATIVIDADE · 7 DIAS
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-end", height: 70 }}>
          {dias.map((d, i) => {
            const h = heights[i] ?? 0;
            const col = h > 70 ? c : h > 45 ? c2 : "rgba(255,255,255,0.12)";
            return (
              <div
                key={`${d}-${i}`}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${h}%`,
                    background: col,
                    borderRadius: "3px 3px 0 0",
                    opacity: 0.75,
                    boxShadow: h > 60 ? `0 0 8px ${col}50` : "none",
                  }}
                />
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.12)" }}>{d}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
