import { motion } from "framer-motion";
import type { CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════════
   MINI-CALENDAR — visualizacao compacta HUD do mes corrente.

   Mostra dias com dots coloridos para eventos/tarefas. Hoje tem
   highlight com glow. Dias passados ficam dimmed.
═══════════════════════════════════════════════════════════════════ */

interface MiniCalendarProps {
  color: string;
  /** Dias que tem eventos/tarefas — Set de numeros (1-31) */
  eventDays?: Set<number>;
  /** Dias que tem deadlines — Set de numeros (1-31) */
  deadlineDays?: Set<number>;
}

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

const mono: CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace",
};

const label: CSSProperties = {
  fontSize: 9,
  fontFamily: "'Share Tech Mono', monospace",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase" as const,
};

export function MiniCalendar({
  color,
  eventDays = new Set(),
  deadlineDays = new Set(),
}: MiniCalendarProps): JSX.Element {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = now.toLocaleDateString("pt-BR", { month: "long" }).toUpperCase();

  // Build grid: empty slots for offset + days
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      style={{
        padding: "14px 16px",
        background: "rgba(255,255,255,0.018)",
        border: `1px solid ${color}18`,
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...label, color }}>{monthName} {year}</div>
        <div style={{ ...label, fontSize: 8 }}>
          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: color, marginRight: 4, verticalAlign: "middle" }} />
          EVENTO
          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#EF4444", marginLeft: 10, marginRight: 4, verticalAlign: "middle" }} />
          DEADLINE
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((d, i) => (
          <div key={`wh-${i}`} style={{ ...mono, fontSize: 8, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const isToday = day === today;
          const isPast = day < today;
          const hasEvent = eventDays.has(day);
          const hasDeadline = deadlineDays.has(day);

          return (
            <div
              key={day}
              style={{
                position: "relative",
                textAlign: "center",
                padding: "4px 0",
                fontSize: 10,
                ...mono,
                color: isToday
                  ? color
                  : isPast
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.45)",
                fontWeight: isToday ? 700 : 400,
                background: isToday ? `${color}12` : "transparent",
                borderRadius: 4,
                boxShadow: isToday ? `0 0 8px ${color}25` : "none",
                border: isToday ? `1px solid ${color}30` : "1px solid transparent",
              }}
            >
              {day}
              {/* Dot indicators */}
              {(hasEvent || hasDeadline) && (
                <div style={{
                  position: "absolute",
                  bottom: 1,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 2,
                }}>
                  {hasEvent && (
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: color }} />
                  )}
                  {hasDeadline && (
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#EF4444" }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
