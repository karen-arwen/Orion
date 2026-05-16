import { useMemo, useState, type CSSProperties } from "react";
import type { SleepLog } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useSleep } from "../../hooks/modules/useSleep.js";

const COLOR = "#7C3AED";

export function SleepPage(): JSX.Element {
  const { summary, isLoading, error, create, remove } = useSleep();
  const defaults = useMemo(() => defaultSleepWindow(), []);
  const [bedTime, setBedTime] = useState(defaults.bedTime);
  const [wakeTime, setWakeTime] = useState(defaults.wakeTime);
  const [quality, setQuality] = useState(4);
  const [notes, setNotes] = useState("");

  const submit = (): void => {
    void create({
      bedTime: new Date(bedTime).toISOString(),
      wakeTime: new Date(wakeTime).toISOString(),
      quality,
      notes: notes.trim() || undefined,
    }).then(() => setNotes(""));
  };

  return (
    <ModuleShell icon="☽" label="SLEEP" sub="Rotina · Qualidade · Relax" color={COLOR}>
      <div style={layoutStyle}>
        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>REGISTRO DE SONO</div>
          <DateTimeField label="Dormiu" value={bedTime} onChange={setBedTime} />
          <DateTimeField label="Acordou" value={wakeTime} onChange={setWakeTime} />
          <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <span className="hud-label" style={smallLabelStyle}>Qualidade {quality}/5</span>
            <input min={1} max={5} type="range" value={quality} onChange={(event) => setQuality(Number(event.target.value))} style={{ accentColor: COLOR }} />
          </label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="nota opcional: cafe, ansiedade, sonho, treino..." style={textareaStyle} />
          <button type="button" className="hud-label" disabled={isLoading} onClick={submit} style={buttonStyle}>REGISTRAR NOITE</button>
          {error && <div style={errorStyle}>{error}</div>}
        </section>

        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>STATUS</div>
          <div style={metricsGridStyle}>
            <Metric label="media" value={formatMinutes(summary?.averageMinutes ?? 0)} />
            <Metric label="consistencia" value={`${summary?.consistencyScore ?? 0}%`} />
            <Metric label="risco" value={`${summary?.insufficientSleepStreak ?? 0}d`} />
          </div>
          <div style={recommendationStyle}>{summary?.recommendation ?? "Registre sua primeira noite."}</div>
          <div style={syncBoxStyle}>
            <div className="hud-label" style={labelStyle}>SYNC AUTOMATICO</div>
            {(summary?.syncSources.length ?? 0) > 0 ? (
              summary?.syncSources.map((source) => (
                <div key={source.id} style={syncRowStyle}>
                  <span>{providerLabel(source.provider)}</span>
                  <span>{source.status}</span>
                </div>
              ))
            ) : (
              <div style={mutedStyle}>
                Ponte pronta no backend. Apple Health precisa de app iOS HealthKit; Samsung/Galaxy usa Health Connect ou Samsung Health Data SDK.
              </div>
            )}
          </div>
        </section>

        <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
          <div className="hud-label" style={labelStyle}>JANELAS DE SONO</div>
          <SleepChart logs={summary?.logs ?? []} onRemove={remove} />
        </section>
      </div>
    </ModuleShell>
  );
}

function defaultSleepWindow(): { bedTime: string; wakeTime: string } {
  const wake = new Date();
  wake.setHours(7, 0, 0, 0);
  const bed = new Date(wake);
  bed.setDate(wake.getDate() - 1);
  bed.setHours(23, 0, 0, 0);
  return {
    bedTime: toLocalInputValue(bed),
    wakeTime: toLocalInputValue(wake),
  };
}

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
      <span className="hud-label" style={smallLabelStyle}>{label}</span>
      <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={metricBoxStyle}>
      <div style={metricValueStyle}>{value}</div>
      <div style={mutedStyle}>{label}</div>
    </div>
  );
}

function SleepChart({ logs, onRemove }: { logs: SleepLog[]; onRemove: (id: string) => Promise<void> }): JSX.Element {
  if (logs.length === 0) return <div style={mutedStyle}>Sem noites registradas ainda.</div>;
  const sorted = [...logs].sort((a, b) => new Date(a.bedTime).getTime() - new Date(b.bedTime).getTime()).slice(-10);
  return (
    <div style={chartStyle}>
      {sorted.map((log) => {
        const bed = new Date(log.bedTime);
        const wake = new Date(log.wakeTime);
        const startHour = bed.getHours() + bed.getMinutes() / 60;
        const duration = log.durationMinutes / 60;
        const left = ((startHour >= 12 ? startHour - 12 : startHour + 12) / 24) * 100;
        const width = Math.min(100 - left, (duration / 24) * 100);
        return (
          <div key={log.id} style={rowStyle}>
            <div style={dateLabelStyle}>{bed.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}</div>
            <div style={trackStyle}>
              <div style={{ ...windowStyle, left: `${left}%`, width: `${Math.max(6, width)}%` }} />
            </div>
            <div style={durationStyle}>{formatMinutes(log.durationMinutes)}</div>
            <button type="button" onClick={() => void onRemove(log.id)} style={removeButtonStyle}>×</button>
            <div style={{ ...mutedStyle, gridColumn: "2 / 5" }}>
              {bed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} → {wake.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · qualidade {log.quality}/5
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (!minutes) return "--";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

function providerLabel(provider: string): string {
  if (provider === "apple_health") return "Apple Health";
  if (provider === "samsung_health") return "Samsung Health";
  if (provider === "health_connect") return "Health Connect";
  return provider;
}

const layoutStyle: CSSProperties = { maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 };
const panelStyle: CSSProperties = { padding: 16, border: `1px solid ${COLOR}22`, borderRadius: 8, background: "rgba(10,15,26,0.72)" };
const labelStyle: CSSProperties = { color: COLOR, fontSize: 10, letterSpacing: "0.12em", marginBottom: 12 };
const smallLabelStyle: CSSProperties = { color: "rgba(255,255,255,0.36)", fontSize: 9 };
const mutedStyle: CSSProperties = { color: "rgba(255,255,255,0.38)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" };
const inputStyle: CSSProperties = { width: "100%", padding: 10, background: "rgba(255,255,255,0.035)", border: `1px solid ${COLOR}30`, borderRadius: 6, color: "#fff", fontSize: 13 };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 82, resize: "vertical", marginBottom: 12 };
const buttonStyle: CSSProperties = { width: "100%", padding: 11, background: "rgba(124,58,237,0.14)", border: `1px solid ${COLOR}66`, color: COLOR, borderRadius: 6, cursor: "pointer", fontSize: 10 };
const errorStyle: CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 10 };
const metricsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 };
const metricBoxStyle: CSSProperties = { padding: 14, background: "rgba(255,255,255,0.025)", border: `1px solid ${COLOR}20`, borderRadius: 8 };
const metricValueStyle: CSSProperties = { color: COLOR, fontSize: 26, fontFamily: "'Share Tech Mono', monospace" };
const recommendationStyle: CSSProperties = { marginTop: 16, padding: 14, border: `1px solid ${COLOR}22`, borderRadius: 8, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 };
const syncBoxStyle: CSSProperties = { marginTop: 14, padding: 14, border: `1px solid ${COLOR}22`, borderRadius: 8, background: "rgba(255,255,255,0.02)" };
const syncRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.68)", fontSize: 12, fontFamily: "'Share Tech Mono', monospace" };
const chartStyle: CSSProperties = { display: "grid", gap: 12 };
const rowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "72px 1fr 70px 30px", gap: 10, alignItems: "center" };
const dateLabelStyle: CSSProperties = { ...mutedStyle, textTransform: "uppercase" };
const trackStyle: CSSProperties = { height: 18, position: "relative", background: "rgba(255,255,255,0.055)", borderRadius: 999, overflow: "hidden" };
const windowStyle: CSSProperties = { position: "absolute", top: 0, bottom: 0, background: COLOR, boxShadow: `0 0 12px ${COLOR}`, borderRadius: 999 };
const durationStyle: CSSProperties = { color: COLOR, fontFamily: "'Share Tech Mono', monospace", fontSize: 13 };
const removeButtonStyle: CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.35)", cursor: "pointer" };
