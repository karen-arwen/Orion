import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { FocusSession } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useFocus } from "../../hooks/modules/useFocus.js";

const COLOR = "#00D4FF";

export function FocusPage(): JSX.Element {
  const { summary, isLoading, error, start, complete, interrupt } = useFocus();
  const [duration, setDuration] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const active = summary?.active ?? null;

  return (
    <ModuleShell icon="◐" label="FOCO" sub="Pomodoro · Flow · Bloqueio" color={COLOR}>
      <div style={layoutStyle}>
        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>SESSAO ATIVA</div>
          <FocusTimer session={active} onComplete={complete} onInterrupt={interrupt} loading={isLoading} />
          {error && <div style={errorStyle}>{error}</div>}
        </section>

        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>INICIAR FOCO</div>
          <div style={presetGridStyle}>
            {[25, 45, 60].map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="hud-label"
                disabled={Boolean(active) || isLoading}
                onClick={() => void start({ duration: minutes, breakMinutes })}
                style={presetButtonStyle}
              >
                {minutes}/5
              </button>
            ))}
          </div>
          <div style={formGridStyle}>
            <NumberField label="Foco" value={duration} min={5} max={240} onChange={setDuration} />
            <NumberField label="Pausa" value={breakMinutes} min={1} max={60} onChange={setBreakMinutes} />
          </div>
          <button
            type="button"
            className="hud-label"
            disabled={Boolean(active) || isLoading}
            onClick={() => void start({ duration, breakMinutes })}
            style={primaryButtonStyle}
          >
            ATIVAR MODO FOCO
          </button>
          <div style={hintStyle}>
            Enquanto houver sessao ativa, o Notification Center mostra apenas alertas de prioridade alta.
          </div>
        </section>

        <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
          <div style={summaryHeaderStyle}>
            <div>
              <div className="hud-label" style={labelStyle}>RELATORIO SEMANAL</div>
              <div style={metricStyle}>{summary?.totalMinutesWeek ?? 0} min</div>
            </div>
            <div style={metricMinorStyle}>{summary?.completedWeek ?? 0} sessoes completas</div>
          </div>
          <WeeklyFocusBars week={summary?.week ?? []} />
          <SessionHistory sessions={summary?.sessions ?? []} />
        </section>
      </div>
    </ModuleShell>
  );
}

function FocusTimer({
  session,
  onComplete,
  onInterrupt,
  loading,
}: {
  session: FocusSession | null;
  onComplete: (id: string) => Promise<void>;
  onInterrupt: (id: string) => Promise<void>;
  loading: boolean;
}): JSX.Element {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timing = useMemo(() => {
    if (!session) return { remaining: 0, total: 1, progress: 0 };
    const started = new Date(session.createdAt).getTime();
    const total = session.duration * 60_000;
    const remaining = Math.max(0, started + total - now);
    return { remaining, total, progress: 1 - remaining / total };
  }, [now, session]);

  if (!session) {
    return (
      <div style={emptyTimerStyle}>
        <div style={timerNumberStyle}>--:--</div>
        <div style={mutedStyle}>Nenhuma sessao ativa.</div>
      </div>
    );
  }

  const minutes = Math.floor(timing.remaining / 60_000);
  const seconds = Math.floor((timing.remaining % 60_000) / 1000);
  const dash = 283 * Math.min(1, Math.max(0, timing.progress));

  return (
    <div style={timerWrapStyle}>
      <svg width="180" height="180" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={COLOR}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} 283`}
          style={{ filter: `drop-shadow(0 0 8px ${COLOR})` }}
        />
      </svg>
      <div style={timerCenterStyle}>
        <div style={timerNumberStyle}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <div style={mutedStyle}>{session.duration} min foco</div>
      </div>
      <div style={timerActionsStyle}>
        <button disabled={loading} className="hud-label" onClick={() => void onComplete(session.id)} style={primaryButtonStyle}>
          CONCLUIR
        </button>
        <button disabled={loading} className="hud-label" onClick={() => void onInterrupt(session.id)} style={ghostButtonStyle}>
          INTERROMPER
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="hud-label" style={{ color: "rgba(255,255,255,0.32)", fontSize: 9 }}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
        style={inputStyle}
      />
    </label>
  );
}

function WeeklyFocusBars({ week }: { week: Array<{ date: string; minutes: number; completed: number }> }): JSX.Element {
  const max = Math.max(60, ...week.map((day) => day.minutes));
  return (
    <div style={weekGridStyle}>
      {week.map((day) => (
        <div key={day.date} style={dayStyle}>
          <div style={barShellStyle}>
            <div style={{ ...barFillStyle, height: `${Math.max(4, (day.minutes / max) * 100)}%` }} />
          </div>
          <div style={dayLabelStyle}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" })}</div>
          <div style={mutedStyle}>{day.minutes}m</div>
        </div>
      ))}
    </div>
  );
}

function SessionHistory({ sessions }: { sessions: FocusSession[] }): JSX.Element {
  const recent = sessions.slice(0, 6);
  if (recent.length === 0) return <div style={mutedStyle}>Sem historico de foco nesta semana.</div>;
  return (
    <div style={historyStyle}>
      {recent.map((session) => (
        <div key={session.id} style={historyItemStyle}>
          <span>{new Date(session.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ color: COLOR }}>{session.duration} min</span>
          <span style={session.completed ? okStyle : mutedStyle}>
            {session.completed ? "completa" : session.interruptedAt ? "interrompida" : "ativa"}
          </span>
        </div>
      ))}
    </div>
  );
}

const layoutStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: 18,
};
const panelStyle: CSSProperties = {
  padding: 16,
  border: `1px solid ${COLOR}18`,
  borderRadius: 8,
  background: "rgba(10,15,26,0.72)",
};
const labelStyle: CSSProperties = { color: COLOR, fontSize: 10, letterSpacing: "0.12em", marginBottom: 12 };
const mutedStyle: CSSProperties = { color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" };
const okStyle: CSSProperties = { ...mutedStyle, color: "#10B981" };
const metricStyle: CSSProperties = { color: COLOR, fontSize: 34, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 };
const metricMinorStyle: CSSProperties = { ...mutedStyle, alignSelf: "end" };
const timerWrapStyle: CSSProperties = { display: "grid", justifyItems: "center", gap: 14, position: "relative" };
const timerCenterStyle: CSSProperties = { position: "absolute", top: 61, textAlign: "center" };
const timerNumberStyle: CSSProperties = { color: COLOR, fontSize: 32, fontFamily: "'Share Tech Mono', monospace", textShadow: `0 0 12px ${COLOR}` };
const emptyTimerStyle: CSSProperties = { minHeight: 240, display: "grid", placeItems: "center", alignContent: "center", gap: 8 };
const timerActionsStyle: CSSProperties = { width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const presetGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 };
const presetButtonStyle: CSSProperties = {
  padding: 10,
  background: "rgba(0,212,255,0.08)",
  border: `1px solid ${COLOR}24`,
  color: COLOR,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 10,
};
const primaryButtonStyle: CSSProperties = {
  width: "100%",
  padding: 11,
  background: "rgba(0,212,255,0.14)",
  border: `1px solid ${COLOR}55`,
  color: COLOR,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 10,
};
const ghostButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.62)",
  border: "1px solid rgba(255,255,255,0.12)",
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  background: "rgba(255,255,255,0.035)",
  border: `1px solid ${COLOR}24`,
  borderRadius: 6,
  color: "#fff",
  fontSize: 13,
};
const hintStyle: CSSProperties = { ...mutedStyle, marginTop: 12, lineHeight: 1.45 };
const summaryHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 18 };
const weekGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, minmax(54px, 1fr))", gap: 10, alignItems: "end", minHeight: 170 };
const dayStyle: CSSProperties = { display: "grid", gap: 6, justifyItems: "center" };
const barShellStyle: CSSProperties = { height: 110, width: "100%", maxWidth: 54, background: "rgba(255,255,255,0.05)", borderRadius: 6, display: "flex", alignItems: "end", overflow: "hidden" };
const barFillStyle: CSSProperties = { width: "100%", background: COLOR, boxShadow: `0 0 12px ${COLOR}`, borderRadius: 6 };
const dayLabelStyle: CSSProperties = { ...mutedStyle, textTransform: "uppercase" };
const historyStyle: CSSProperties = { display: "grid", gap: 8, marginTop: 18 };
const historyItemStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 8, padding: "9px 10px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, color: "rgba(255,255,255,0.62)", fontSize: 12 };
const errorStyle: CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 10 };
