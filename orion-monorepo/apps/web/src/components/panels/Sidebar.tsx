import type { OrionModule, UserProfile, UserVitals } from "@orion/types";
import { ModuleGrid } from "./ModuleGrid.js";
import { ALL_MODULES } from "../../lib/constants.js";

interface SidebarProps {
  profile: UserProfile;
  activeModule: OrionModule | null;
  onModuleClick: (mod: OrionModule) => void;
  vitals: UserVitals;
}

interface VitalRender {
  label: string;
  value: number;
  color: string;
  icon: string;
}

/* ═══════════════════════════════════════════════════════════════════
   Sidebar — coluna esquerda do Painel Stark.

   Refeito: header com badge LIVE-COUNT, grid de modulos, e VITALS no
   rodape em formato compacto com glow e label clarificada.
═══════════════════════════════════════════════════════════════════ */

export function Sidebar({ profile, activeModule, onModuleClick, vitals }: SidebarProps): JSX.Element {
  const color = profile.theme.primary;
  const liveCount = ALL_MODULES.filter((m) => m.hasReal).length;

  const vitalsList: VitalRender[] = [
    { label: "ENERGIA", value: vitals.energy, color: "#10B981", icon: "⚡" },
    { label: "FOCO", value: vitals.focus, color, icon: "◎" },
    { label: "HUMOR", value: vitals.mood, color: "#F59E0B", icon: "✦" },
  ];

  return (
    <div
      style={{
        borderRight: `1px solid ${color}15`,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, rgba(255,255,255,0.012), transparent 60%)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Linha vertical de acento na direita */}
      <div style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 1,
        background: `linear-gradient(180deg, transparent, ${color}33, transparent)`,
        opacity: 0.6,
        pointerEvents: "none",
      }} />

      {/* ━━━ HEADER ━━━ */}
      <div style={{
        padding: "12px 12px 8px",
        borderBottom: `1px solid ${color}10`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            className="hud-label"
            style={{ fontSize: 8, color: "rgba(255,255,255,0.32)", letterSpacing: "0.24em" }}
          >
            MODULOS
          </span>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.04em",
          }}>
            {ALL_MODULES.length}
          </span>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 6px",
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: 3,
          alignSelf: "flex-start",
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#10B981",
            boxShadow: "0 0 5px #10B981",
            animation: "ripple 2s ease-out infinite",
          }} />
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 8,
            color: "#10B981",
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}>
            {liveCount} LIVE
          </span>
        </div>
      </div>

      {/* ━━━ GRID ━━━ */}
      <ModuleGrid primaryColor={color} activeModule={activeModule} onModuleClick={onModuleClick} />

      {/* ━━━ VITALS (footer) ━━━ */}
      <div
        style={{
          padding: "12px 12px 14px",
          borderTop: `1px solid ${color}15`,
          flexShrink: 0,
          background: "linear-gradient(180deg, transparent, rgba(0, 212, 255, 0.018))",
        }}
      >
        <div
          className="hud-label"
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.3)",
            marginBottom: 12,
            letterSpacing: "0.24em",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>VITALS</span>
          <span style={{ fontSize: 7, color: "rgba(255,255,255,0.15)" }}>NOW</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", gap: 4 }}>
          {vitalsList.map((v) => {
            const r = 17;
            const circ = 2 * Math.PI * r;
            const dash = (v.value / 100) * circ;
            return (
              <div
                key={v.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flex: 1,
                }}
                title={`${v.label}: ${v.value}%`}
              >
                <div style={{ position: "relative", width: 44, height: 44 }}>
                  <svg width={44} height={44} style={{ filter: `drop-shadow(0 0 3px ${v.color}66)` }}>
                    <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3} />
                    <circle
                      cx={22}
                      cy={22}
                      r={r}
                      fill="none"
                      stroke={v.color}
                      strokeWidth={3}
                      strokeDasharray={`${dash} ${circ}`}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"
                      style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
                    />
                  </svg>
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 10, color: v.color, marginBottom: -1, textShadow: `0 0 4px ${v.color}` }}>
                      {v.icon}
                    </span>
                    <span style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 8.5,
                      color: v.color,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}>
                      {v.value}
                    </span>
                  </div>
                </div>
                <span
                  className="hud-label"
                  style={{
                    fontSize: 7,
                    color: "rgba(255,255,255,0.32)",
                    letterSpacing: "0.18em",
                  }}
                >
                  {v.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
