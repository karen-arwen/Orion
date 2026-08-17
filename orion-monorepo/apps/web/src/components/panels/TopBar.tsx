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
  alertCount: number;
  onCommandOpen: () => void;
  onNotificationsOpen: () => void;
}

const PROVIDER_META: Record<string, { label: string; icon: string }> = {
  gmail:  { label: "GMAIL",    icon: "✉" },
  gcal:   { label: "CALENDAR", icon: "⬡" },
  gdrive: { label: "DRIVE",    icon: "◧" },
  notion: { label: "NOTION",   icon: "◇" },
  slack:  { label: "SLACK",    icon: "◫" },
};

const MODE_DESCRIPTIONS: Record<OrionMode, string> = {
  SILENCIOSO: "Apenas o critico, sem interrupcao",
  NORMAL: "Proativo com bom senso",
  STARK: "Ultra proativo, antecipa e cruza tudo",
};

export function TopBar({
  profile,
  mode,
  onModeChange,
  connectedProviders,
  alertCount,
  onCommandOpen,
  onNotificationsOpen,
}: TopBarProps): JSX.Element {
  const [time, setTime] = useState<Date>(() => new Date());
  const [modeTooltip, setModeTooltip] = useState<OrionMode | null>(null);
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

  const statusEntries = ["gmail", "gcal", "gdrive"] as const;
  const isCmdMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const cmdKey = isCmdMac ? "⌘" : "Ctrl";

  return (
    <div
      style={{
        height: 62,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 16,
        borderBottom: `1px solid ${color}18`,
        background: "rgba(3,5,9,0.93)",
        backdropFilter: "blur(24px)",
        position: "relative",
        zIndex: 20,
      }}
    >
      {/* Linha de acento no topo */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${color}77, ${color}22, transparent)`,
        opacity: 0.7,
      }} />

      {/* ━━━ LOGO + NOME ━━━ */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <NeuralRing color={color} size={40} />
        <div>
          <div
            className="hud-label"
            style={{
              fontSize: 17,
              color,
              textShadow: `0 0 18px ${color}88`,
              letterSpacing: "0.3em",
              fontWeight: 700,
            }}
          >
            O.R.I.O.N
          </div>
          <div className="hud-label" style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", marginTop: 1, letterSpacing: "0.18em" }}>
            OMNI-RESPONSIVE INTELLIGENT OPERATING NEXUS
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: `${color}15`, marginLeft: 6 }} />

      {/* ━━━ INTEGRATION STATUS ━━━ */}
      <Link
        to="/integrations"
        style={{
          display: "flex",
          gap: 4,
          textDecoration: "none",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 6,
          transition: "background 150ms ease",
        }}
        title="Gerenciar integracoes"
        onMouseEnter={(e) => { e.currentTarget.style.background = `${color}08`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {statusEntries.map((s) => {
          const active = connectedProviders.includes(s);
          const meta = PROVIDER_META[s] ?? { label: s.toUpperCase(), icon: "◯" };
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                background: active ? `${"#10B981"}10` : "transparent",
                border: `1px solid ${active ? "#10B98133" : "rgba(255,255,255,0.04)"}`,
                borderRadius: 4,
              }}
            >
              <span style={{
                fontSize: 11,
                color: active ? "#10B981" : "rgba(255,255,255,0.18)",
                textShadow: active ? "0 0 6px #10B98199" : "none",
              }}>
                {meta.icon}
              </span>
              <span
                className="hud-label"
                style={{
                  fontSize: 8,
                  color: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.18)",
                  letterSpacing: "0.18em",
                }}
              >
                {meta.label}
              </span>
              <StatusDot active={active} color="#10B981" pulse={active} />
            </div>
          );
        })}
      </Link>

      {/* ━━━ DIREITA ━━━ */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>

        {/* Command Palette button */}
        <button
          onClick={onCommandOpen}
          title="Command Palette"
          aria-label="Abrir Command Palette"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px 5px 8px",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${color}25`,
            color: `${color}DD`,
            fontSize: 11,
            fontFamily: "'Share Tech Mono', monospace",
            borderRadius: 5,
            cursor: "pointer",
            transition: "all 150ms ease",
            letterSpacing: "0.06em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${color}10`;
            e.currentTarget.style.boxShadow = `0 0 8px ${color}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ fontSize: 11 }}>⌕</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>
            {cmdKey} K
          </span>
        </button>

        {/* Notifications button */}
        <button
          onClick={onNotificationsOpen}
          title="Notification Center"
          aria-label="Abrir notificacoes"
          style={{
            position: "relative",
            width: 32,
            height: 32,
            background: alertCount ? "#F59E0B12" : "rgba(255,255,255,0.02)",
            border: `1px solid ${alertCount ? "#F59E0B55" : `${color}20`}`,
            color: alertCount ? "#F59E0B" : color,
            fontSize: 14,
            borderRadius: 5,
            cursor: "pointer",
            transition: "all 150ms ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: alertCount ? "0 0 10px #F59E0B33" : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = alertCount ? "#F59E0B22" : `${color}10`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = alertCount ? "#F59E0B12" : "rgba(255,255,255,0.02)";
          }}
        >
          ◔
          {alertCount > 0 && (
            <span style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              background: "#F59E0B",
              color: "#030509",
              fontSize: 9,
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 700,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 8px #F59E0BAA",
            }}>
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </button>

        {/* Mode toggle (com tooltip) */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              gap: 3,
              padding: 3,
              background: "rgba(255,255,255,0.018)",
              borderRadius: 7,
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {MODES.map((m) => {
              const isActive = mode === m;
              const c = modeColors[m];
              return (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  onMouseEnter={() => setModeTooltip(m)}
                  onMouseLeave={() => setModeTooltip(null)}
                  className="hud-label"
                  style={{
                    padding: "3px 11px",
                    fontSize: 8,
                    background: isActive ? `${c}22` : "transparent",
                    border: isActive ? `1px solid ${c}66` : "1px solid transparent",
                    color: isActive ? c : "rgba(255,255,255,0.2)",
                    borderRadius: 5,
                    cursor: "pointer",
                    letterSpacing: "0.12em",
                    textShadow: isActive ? `0 0 6px ${c}AA` : "none",
                    fontWeight: isActive ? 700 : 400,
                    boxShadow: isActive ? `0 0 8px ${c}33, inset 0 0 4px ${c}22` : "none",
                    transition: "all 150ms ease",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {modeTooltip && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              padding: "6px 10px",
              background: "#030509EE",
              border: `1px solid ${modeColors[modeTooltip]}55`,
              borderRadius: 5,
              fontSize: 10.5,
              color: "rgba(255,255,255,0.78)",
              whiteSpace: "nowrap",
              boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 8px ${modeColors[modeTooltip]}33`,
              zIndex: 50,
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: "0.02em",
              pointerEvents: "none",
              animation: "fadeIn 0.15s ease both",
            }}>
              {MODE_DESCRIPTIONS[modeTooltip]}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: `${color}15` }} />

        {/* Clock */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 16,
              fontFamily: "'Share Tech Mono', monospace",
              color,
              letterSpacing: "0.1em",
              textShadow: `0 0 12px ${color}66`,
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="hud-label" style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", letterSpacing: "0.22em", marginTop: 2 }}>
            {time
              .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
              .toUpperCase()}
          </div>
        </div>

        {/* User */}
        <UserButton
          appearance={{
            elements: { userButtonAvatarBox: "w-8 h-8 ring-1 ring-cyan-400/30" },
          }}
        />
      </div>
    </div>
  );
}
