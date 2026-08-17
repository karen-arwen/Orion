import { motion } from "framer-motion";
import type { CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════════
   STREAKS HEATMAP — grid 365 dias estilo GitHub contributions.
   Verde = habitos completos naquele dia. Mais verde = mais completos.
═══════════════════════════════════════════════════════════════════ */

interface Props {
  /** Map de "YYYY-MM-DD" → numero de habitos completos nesse dia */
  data: Record<string, number>;
  color: string;
  /** Maximo possivel por dia (total de habitos ativos) */
  maxPerDay: number;
}

const mono: CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const CELL = 10;
const GAP = 2;

function getIntensity(count: number, max: number): string {
  if (count === 0 || max === 0) return "rgba(255,255,255,0.03)";
  const ratio = count / max;
  if (ratio >= 0.9) return "#10B981";
  if (ratio >= 0.6) return "#10B98188";
  if (ratio >= 0.3) return "#10B98144";
  return "#10B98122";
}

export function StreaksHeatmap({ data, color, maxPerDay }: Props): JSX.Element {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  // Align to start of week (Sunday)
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: Array<Array<{ date: string; count: number; isToday: boolean; isFuture: boolean }>> = [];
  const current = new Date(startDate);

  while (current <= today || weeks.length < 53) {
    const week: Array<{ date: string; count: number; isToday: boolean; isFuture: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const key = current.toISOString().slice(0, 10);
      const isToday = key === today.toISOString().slice(0, 10);
      const isFuture = current > today;
      week.push({
        date: key,
        count: data[key] ?? 0,
        isToday,
        isFuture,
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (weeks.length >= 53) break;
  }

  // Month labels
  const monthLabels: Array<{ label: string; weekIdx: number }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = new Date(week[0]!.date);
    const m = firstDay.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: MONTHS[m]!, weekIdx: wi });
      lastMonth = m;
    }
  });

  // Stats
  const totalDays = Object.values(data).filter((v) => v > 0).length;
  const currentStreak = (() => {
    let streak = 0;
    const d = new Date(today);
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if ((data[key] ?? 0) > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return streak;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      style={{
        padding: "14px 16px",
        background: "rgba(255,255,255,0.018)",
        border: `1px solid ${color}18`,
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ ...mono, fontSize: 9, color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          CONSISTENCIA
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ ...mono, fontSize: 10, color: "#10B981" }}>{currentStreak}d streak</span>
          <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{totalDays} dias ativos</span>
        </div>
      </div>

      {/* Month labels */}
      <div style={{ display: "flex", gap: GAP, marginBottom: 2, paddingLeft: 16 }}>
        {monthLabels.map((m) => (
          <div
            key={`${m.label}-${m.weekIdx}`}
            style={{
              position: "absolute" as const,
              left: 16 + m.weekIdx * (CELL + GAP),
              ...mono,
              fontSize: 7,
              color: "rgba(255,255,255,0.2)",
            }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ position: "relative", marginTop: 14, overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
              {week.map((day) => (
                <div
                  key={day.date}
                  title={day.isFuture ? "" : `${day.date}: ${day.count}/${maxPerDay}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 2,
                    background: day.isFuture ? "transparent" : getIntensity(day.count, maxPerDay),
                    border: day.isToday ? `1px solid ${color}` : "none",
                    boxShadow: day.isToday ? `0 0 4px ${color}40` : "none",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
        <span style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.2)" }}>MENOS</span>
        {["rgba(255,255,255,0.03)", "#10B98122", "#10B98144", "#10B98188", "#10B981"].map((c, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 1, background: c }} />
        ))}
        <span style={{ ...mono, fontSize: 7, color: "rgba(255,255,255,0.2)" }}>MAIS</span>
      </div>
    </motion.div>
  );
}
