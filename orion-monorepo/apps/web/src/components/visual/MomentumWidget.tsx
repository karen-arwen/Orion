import { motion } from "framer-motion";
import { RingGauge } from "./RingGauge.js";
import type { MomentumBreakdown } from "../../hooks/useMomentum.js";
import type { CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════════
   MOMENTUM WIDGET — hero do dashboard. Score unico 0-100.
   Ring gauge grande + 5 mini-bars das dimensoes.
═══════════════════════════════════════════════════════════════════ */

interface Props {
  data: MomentumBreakdown;
  color: string;
}

const mono: CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };
const label: CSSProperties = {
  fontSize: 8,
  fontFamily: "'Share Tech Mono', monospace",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase" as const,
};

function scoreColor(score: number): string {
  if (score >= 75) return "#10B981";
  if (score >= 50) return "#00D4FF";
  if (score >= 30) return "#F59E0B";
  return "#EF4444";
}

const trendIcon: Record<string, string> = {
  rising: "↑",
  stable: "→",
  falling: "↓",
};

const trendColor: Record<string, string> = {
  rising: "#10B981",
  stable: "rgba(255,255,255,0.3)",
  falling: "#EF4444",
};

export function MomentumWidget({ data, color }: Props): JSX.Element {
  const sc = scoreColor(data.score);
  const dimensions = [
    { key: "SONO", val: data.sleep, max: 20, col: "#7C3AED" },
    { key: "FOCO", val: data.focus, max: 20, col: color },
    { key: "HABITOS", val: data.habits, max: 20, col: "#10B981" },
    { key: "HUMOR", val: data.mood, max: 20, col: "#F59E0B" },
    { key: "PROD", val: data.productivity, max: 20, col: "#EF4444" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        padding: "18px 20px",
        background: "rgba(255,255,255,0.018)",
        border: `1px solid ${sc}20`,
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* Ring gauge grande */}
        <div style={{ position: "relative" }}>
          <RingGauge
            value={data.score}
            size={80}
            thickness={5}
            color={sc}
            centerLabel={String(data.score)}
            bottomLabel="MOMENTUM"
          />
        </div>

        {/* Insight + trend */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ ...label, color: sc, fontSize: 10 }}>MOMENTUM SCORE</span>
            <span style={{
              ...mono,
              fontSize: 12,
              color: trendColor[data.trend],
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}>
              {trendIcon[data.trend]} {data.trend.toUpperCase()}
            </span>
          </div>
          <div style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.5,
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            {data.insight}
          </div>
        </div>
      </div>

      {/* Mini bars */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {dimensions.map((d, i) => (
          <motion.div
            key={d.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.25 }}
            style={{ flex: 1, textAlign: "center" }}
          >
            <div style={{ ...label, fontSize: 7, marginBottom: 4 }}>{d.key}</div>
            <div style={{
              height: 4,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 2,
              overflow: "hidden",
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(d.val / d.max) * 100}%` }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                style={{
                  height: "100%",
                  background: d.col,
                  borderRadius: 2,
                  boxShadow: `0 0 6px ${d.col}40`,
                }}
              />
            </div>
            <div style={{ ...mono, fontSize: 10, color: d.col, marginTop: 3 }}>
              {d.val}/{d.max}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
