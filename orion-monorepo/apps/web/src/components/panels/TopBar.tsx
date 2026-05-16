import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import type { OrionMode, UserProfile } from "@orion/types";
import { NeuralRing } from "../visual/NeuralRing.js";
import { StatusDot } from "../visual/StatusDot.js";
import { MODES } from "../../lib/constants.js";

interface TopBarProps {
  profile: UserProfile;
  mode: OrionMode;
  onModeChange: (m: OrionMode) => void;
  connectedProviders: string[];
}

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "GMAIL",
  gcal: "CALENDAR",
  gdrive: "DRIVE",
  notion: "NOTION",
  slack: "SLACK",
};

export function TopBar({ profile, mode, onModeChange, connectedProviders }: TopBarProps): JSX.Element {
  const [time, setTime] = useState<Date>(() => new Date());
  const color = profile.theme.primary;

  useEffect(() => {
    const t = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const modeColors: Record<OrionMode, string> = {
    SILENCIOSO: "#64748B",
    NORMAL: color,
    STARK: "#F59E0B",
  };

  const statusEntries = ["gmail", "gcal", "gdrive", "iot"] as const;

  return (
    <div
      style={{
        height: 58,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 14,
        borderBottom: `1px solid ${color}18`,
        background: "rgba(3,5,9,0.93)",
        backdropFilter: "blur(24px)",
        position: "relative",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <NeuralRing color={color} size={38} />
        <div>
          <div
            className="hud-label"
            style={{ fontSize: 17, color, textShadow: `0 0 20px ${color}80`, letterSpacing: "0.28em" }}
          >
            O.R.I.O.N
          </div>
          <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", marginTop: 1 }}>
            OMNI-RESPONSIVE INTELLIGENT OPERATING NEXUS
          </div>
        </div>
      </div>

      <Link
        to="/integrations"
        style={{ display: "flex", gap: 14, marginLeft: 8, textDecoration: "none", cursor: "pointer" }}
        title="Gerenciar integrações"
      >
        {statusEntries.map((s) => {
          const active = connectedProviders.includes(s);
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <StatusDot active={active} color="#10B981" pulse={active} />
              <span
                className="hud-label"
                style={{
                  fontSize: 8,
                  color: active ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.12)",
                }}
              >
                {PROVIDER_LABELS[s] ?? s.toUpperCase()}
              </span>
            </div>
          );
        })}
      </Link>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            gap: 3,
            padding: 3,
            background: "rgba(255,255,255,0.015)",
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className="hud-label"
              style={{
                padding: "2px 9px",
                fontSize: 8,
                background: mode === m ? `${modeColors[m]}18` : "transparent",
                border: mode === m ? `1px solid ${modeColors[m]}40` : "1px solid transparent",
                color: mode === m ? modeColors[m] : "rgba(255,255,255,0.15)",
                borderRadius: 5,
                cursor: "pointer",
                letterSpacing: "0.08em",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 15,
              fontFamily: "'Share Tech Mono', monospace",
              color,
              letterSpacing: "0.08em",
              textShadow: `0 0 12px ${color}50`,
            }}
          >
            {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.12)" }}>
            {time
              .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
              .toUpperCase()}
          </div>
        </div>

        <UserButton
          appearance={{
            elements: { userButtonAvatarBox: "w-8 h-8 ring-1 ring-cyan-400/30" },
          }}
        />
      </div>
    </div>
  );
}
