import { useEffect, useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useCompleteFocus,
  useFocusToday,
  useFocusWeekly,
  useInterruptFocus,
  useStartFocus,
} from "../../hooks/modules/useFocus.js";

const PRIMARY = "#00D4FF";

export function FocusPage(): JSX.Element {
  const [duration, setDuration] = useState(25);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStart, setActiveStart] = useState<number | null>(null);
  const [activeDur, setActiveDur] = useState<number>(25);
  const [elapsed, setElapsed] = useState(0);

  const start = useStartFocus();
  const complete = useCompleteFocus();
  const interrupt = useInterruptFocus();
  const { data: today } = useFocusToday();
  const { data: weekly } = useFocusWeekly();

  // Ticker do timer ativo
  useEffect(() => {
    if (!activeStart) return;
    const tick = (): void => setElapsed(Math.floor((Date.now() - activeStart) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeStart]);

  const handleStart = (): void => {
    start.mutate(duration, {
      onSuccess: (s) => {
        setActiveId(s.id);
        setActiveStart(new Date(s.startedAt).getTime());
        setActiveDur(s.duration);
      },
    });
  };

  const handleComplete = (): void => {
    if (!activeId) return;
    complete.mutate(activeId, {
      onSuccess: () => {
        setActiveId(null);
        setActiveStart(null);
        setElapsed(0);
      },
    });
  };

  const handleInterrupt = (): void => {
    if (!activeId) return;
    interrupt.mutate(activeId, {
      onSuccess: () => {
        setActiveId(null);
        setActiveStart(null);
        setElapsed(0);
      },
    });
  };

  // SVG ring
  const totalSec = activeDur * 60;
  const progress = Math.min(1, elapsed / totalSec);
  const radius = 90;
  const circ = 2 * Math.PI * radius;
  const dash = progress * circ;

  const min = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const sec = String(elapsed % 60).padStart(2, "0");

  // Weekly stats
  const maxMin = weekly?.reduce((a, b) => Math.max(a, b.minutes), 0) ?? 0;

  return (
    <ModuleShell icon="◐" label="FOCO" sub="Pomodoro · Flow · Concentração" color={PRIMARY}>
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        {/* Timer */}
        <div style={{ marginBottom: 30 }}>
          <svg width={220} height={220} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={110}
              cy={110}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={4}
            />
            <circle
              cx={110}
              cy={110}
              r={radius}
              fill="none"
              stroke={PRIMARY}
              strokeWidth={4}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{
                transition: "stroke-dasharray 0.6s linear",
                filter: activeId ? `drop-shadow(0 0 8px ${PRIMARY})` : "none",
              }}
            />
          </svg>
          <div
            style={{
              marginTop: -160,
              fontSize: 48,
              fontFamily: "'Share Tech Mono', monospace",
              color: PRIMARY,
              textShadow: `0 0 16px ${PRIMARY}80`,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            {activeId ? `${min}:${sec}` : `${duration.toString().padStart(2, "0")}:00`}
          </div>
          <div
            className="hud-label"
            style={{
              marginTop: 6,
              fontSize: 10,
              color: activeId ? "#10B981" : "rgba(255,255,255,0.4)",
              letterSpacing: "0.25em",
            }}
          >
            {activeId ? "FOCO ATIVO" : "PRONTA PRA COMEÇAR"}
          </div>
        </div>

        {/* Controles */}
        {!activeId ? (
          <div style={{ marginBottom: 30 }}>
            <div
              className="hud-label"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}
            >
              DURAÇÃO
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
              {[15, 25, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="hud-label"
                  style={{
                    padding: "6px 14px",
                    fontSize: 10,
                    background: duration === d ? `${PRIMARY}25` : "transparent",
                    border: `1px solid ${duration === d ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                    color: duration === d ? PRIMARY : "rgba(255,255,255,0.4)",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {d}MIN
                </button>
              ))}
            </div>
            <button
              onClick={handleStart}
              disabled={start.isPending}
              className="hud-label"
              style={{
                padding: "12px 28px",
                fontSize: 12,
                background: `linear-gradient(135deg, ${PRIMARY}30, #7C3AED20)`,
                border: `1px solid ${PRIMARY}`,
                color: PRIMARY,
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: `0 0 20px ${PRIMARY}30`,
              }}
            >
              {start.isPending ? "INICIANDO…" : "▶ INICIAR SESSÃO"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 30 }}>
            <button
              onClick={handleComplete}
              className="hud-label"
              style={{
                padding: "10px 20px",
                fontSize: 11,
                background: "rgba(16,185,129,0.2)",
                border: "1px solid #10B981",
                color: "#10B981",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ✓ COMPLETEI
            </button>
            <button
              onClick={handleInterrupt}
              className="hud-label"
              style={{
                padding: "10px 20px",
                fontSize: 11,
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.5)",
                color: "#EF4444",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              × INTERROMPER
            </button>
          </div>
        )}

        {/* Weekly */}
        {weekly && (
          <div
            style={{
              padding: 16,
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
              marginBottom: 14,
              textAlign: "left",
            }}
          >
            <div
              className="hud-label"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}
            >
              ◎ FOCO DA SEMANA · MINUTOS POR DIA
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
              {weekly.map((d) => {
                const h = maxMin > 0 ? (d.minutes / maxMin) * 100 : 0;
                return (
                  <div
                    key={d.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: `${Math.max(2, h)}%`,
                        background: d.minutes > 0 ? PRIMARY : "rgba(255,255,255,0.05)",
                        borderRadius: "3px 3px 0 0",
                        opacity: 0.75,
                        boxShadow: d.minutes > 0 ? `0 0 6px ${PRIMARY}50` : "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,0.3)",
                        fontFamily: "'Share Tech Mono', monospace",
                      }}
                    >
                      {d.minutes}m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today sessions */}
        {today && today.length > 0 && (
          <div
            style={{
              padding: 16,
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
              textAlign: "left",
            }}
          >
            <div
              className="hud-label"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}
            >
              SESSÕES DE HOJE · {today.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {today.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      s.completed
                        ? "rgba(16,185,129,0.2)"
                        : s.interruptedAt
                        ? "rgba(239,68,68,0.2)"
                        : "rgba(0,212,255,0.2)"
                    }`,
                    borderRadius: 5,
                    display: "flex",
                    gap: 10,
                    fontSize: 11,
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>
                    {new Date(s.startedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>
                    {s.duration}min planejados
                  </span>
                  {s.actualMinutes !== null && (
                    <span style={{ color: s.completed ? "#10B981" : "#EF4444" }}>
                      {s.completed ? "✓" : "×"} {s.actualMinutes}min reais
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
