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
}

export function Sidebar({ profile, activeModule, onModuleClick, vitals }: SidebarProps): JSX.Element {
  const color = profile.theme.primary;
  const vitalsList: VitalRender[] = [
    { label: "Energia", value: vitals.energy, color: "#10B981" },
    { label: "Foco", value: vitals.focus, color },
    { label: "Mood", value: vitals.mood, color: "#F59E0B" },
  ];

  return (
    <div
      style={{
        borderRight: `1px solid ${color}12`,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, rgba(255,255,255,0.01), transparent)",
        overflow: "hidden",
      }}
    >
      <div
        className="hud-label"
        style={{ padding: "12px 12px 6px", fontSize: 8, color: "rgba(255,255,255,0.13)", letterSpacing: "0.2em" }}
      >
        MÓDULOS · {ALL_MODULES.length} TOTAL
      </div>
      <ModuleGrid primaryColor={color} activeModule={activeModule} onModuleClick={onModuleClick} />

      <div style={{ padding: 12, borderTop: `1px solid ${color}10`, flexShrink: 0 }}>
        <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", marginBottom: 10 }}>
          VITALS
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {vitalsList.map((v) => {
            const r = 16;
            const circ = 2 * Math.PI * r;
            const dash = (v.value / 100) * circ;
            return (
              <div
                key={v.label}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
              >
                <svg width={40} height={40}>
                  <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={3} />
                  <circle
                    cx={20}
                    cy={20}
                    r={r}
                    fill="none"
                    stroke={v.color}
                    strokeWidth={3}
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    transform="rotate(-90 20 20)"
                    style={{ filter: `drop-shadow(0 0 3px ${v.color})` }}
                  />
                  <text
                    x={20}
                    y={24}
                    textAnchor="middle"
                    fill={v.color}
                    fontSize={9}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {v.value}%
                  </text>
                </svg>
                <span
                  className="hud-label"
                  style={{ fontSize: 7, color: "rgba(255,255,255,0.19)" }}
                >
                  {v.label.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
