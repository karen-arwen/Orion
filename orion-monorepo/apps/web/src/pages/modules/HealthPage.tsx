import { useState } from "react";
import type { EnergyLog } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useHealth } from "../../hooks/modules/useHealth.js";

const COLOR = "#10B981";

export function HealthPage(): JSX.Element {
  const { summary, isLoading, error, logEnergy } = useHealth();
  const [value, setValue] = useState(6);
  const [note, setNote] = useState("");

  const submit = (): void => {
    void logEnergy({ value, note: note.trim() || undefined }).then(() => setNote(""));
  };

  return (
    <ModuleShell icon="♡" label="SAUDE" sub="Energia · Pausas · Padroes" color={COLOR}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>REGISTRO DE ENERGIA</div>
          <div style={{ fontSize: 58, color: COLOR, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>
            {value}
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            style={{ width: "100%", accentColor: COLOR, margin: "18px 0" }}
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="nota opcional: sono, cafe, treino, estresse..."
            style={inputStyle}
          />
          <button onClick={submit} disabled={isLoading} className="hud-label" style={buttonStyle}>
            {isLoading ? "SALVANDO..." : "REGISTRAR AGORA"}
          </button>
          {error && <div style={errorStyle}>{error}</div>}
          {summary && (
            <div style={{ marginTop: 18, padding: 12, border: `1px solid ${COLOR}22`, borderRadius: 8 }}>
              <div className="hud-label" style={{ ...labelStyle, marginBottom: 6 }}>RECOMENDACAO</div>
              <div style={textStyle}>{summary.recommendation}</div>
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>TIMELINE</div>
          <EnergyTimeline logs={summary?.today ?? []} />
          <div style={{ height: 18 }} />
          <div className="hud-label" style={labelStyle}>SEMANA</div>
          <WeeklyBars logs={summary?.week ?? []} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            <PatternCard title="PICO" hour={summary?.peakEnergyPattern?.hour} avg={summary?.peakEnergyPattern?.average} />
            <PatternCard title="QUEDA" hour={summary?.lowEnergyPattern?.hour} avg={summary?.lowEnergyPattern?.average} />
          </div>
        </section>
      </div>
    </ModuleShell>
  );
}

function EnergyTimeline({ logs }: { logs: EnergyLog[] }): JSX.Element {
  const byHour = new Map<number, EnergyLog>();
  for (const log of logs) byHour.set(new Date(log.createdAt).getHours(), log);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6 }}>
      {Array.from({ length: 24 }, (_, hour) => {
        const log = byHour.get(hour);
        const intensity = log ? log.value / 10 : 0;
        return (
          <div key={hour} title={`${hour}h ${log ? `energia ${log.value}` : "sem registro"}`}>
            <div
              style={{
                height: 28,
                borderRadius: 5,
                background: log ? `rgba(16,185,129,${0.16 + intensity * 0.72})` : "rgba(255,255,255,0.035)",
                border: `1px solid ${log ? COLOR + "55" : "rgba(255,255,255,0.05)"}`,
              }}
            />
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", textAlign: "center", marginTop: 3 }}>{hour}</div>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyBars({ logs }: { logs: EnergyLog[] }): JSX.Element {
  const days = new Map<string, { total: number; count: number }>();
  for (const log of logs) {
    const label = new Date(log.createdAt).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    const current = days.get(label) ?? { total: 0, count: 0 };
    days.set(label, { total: current.total + log.value, count: current.count + 1 });
  }
  const values = Array.from(days.entries()).slice(-7);
  if (values.length === 0) return <div style={mutedStyle}>Sem registros nesta semana.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {values.map(([day, bucket]) => {
        const avg = bucket.total / bucket.count;
        return (
          <div key={day} style={{ display: "grid", gridTemplateColumns: "72px 1fr 34px", gap: 8, alignItems: "center" }}>
            <span style={mutedStyle}>{day}</span>
            <div style={{ height: 9, background: "rgba(255,255,255,0.05)", borderRadius: 999 }}>
              <div style={{ width: `${avg * 10}%`, height: "100%", background: COLOR, borderRadius: 999, boxShadow: `0 0 8px ${COLOR}` }} />
            </div>
            <span style={{ ...mutedStyle, color: COLOR }}>{avg.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

function PatternCard({ title, hour, avg }: { title: string; hour?: number; avg?: number }): JSX.Element {
  return (
    <div style={{ padding: 14, background: "rgba(255,255,255,0.025)", border: `1px solid ${COLOR}20`, borderRadius: 8 }}>
      <div className="hud-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{title}</div>
      <div style={{ color: COLOR, fontSize: 24, fontFamily: "'Share Tech Mono', monospace" }}>
        {hour === undefined ? "--" : `${hour}h`}
      </div>
      <div style={mutedStyle}>{avg === undefined ? "sem dados" : `media ${avg}/10`}</div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${COLOR}18`,
  borderRadius: 8,
  background: "rgba(10,15,26,0.72)",
};
const labelStyle: React.CSSProperties = { color: COLOR, fontSize: 10, letterSpacing: "0.16em", marginBottom: 12 };
const textStyle: React.CSSProperties = { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.55 };
const mutedStyle: React.CSSProperties = { color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 84,
  resize: "vertical",
  padding: 10,
  background: "rgba(255,255,255,0.035)",
  border: `1px solid ${COLOR}24`,
  borderRadius: 6,
  color: "#fff",
  fontSize: 12,
  marginBottom: 12,
};
const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 11,
  background: "rgba(16,185,129,0.14)",
  border: `1px solid ${COLOR}55`,
  color: COLOR,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 10,
};
const errorStyle: React.CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 10 };
