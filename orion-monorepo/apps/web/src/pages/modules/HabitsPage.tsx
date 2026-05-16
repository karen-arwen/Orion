import { useState, type CSSProperties } from "react";
import type { HabitWithLogs } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useHabits } from "../../hooks/modules/useHabits.js";

const COLOR = "#10B981";
const COLORS = ["#00D4FF", "#10B981", "#F59E0B", "#EC4899", "#7C3AED"];

export function HabitsPage(): JSX.Element {
  const { summary, isLoading, error, create, toggle, remove } = useHabits();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState("✓");

  const submit = (): void => {
    if (!name.trim()) return;
    void create({ name, frequency, color, icon }).then(() => setName(""));
  };

  return (
    <ModuleShell icon="✓" label="HABITOS" sub="Streak · Tracking · Coach" color={COLOR}>
      <div style={layoutStyle}>
        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>NOVO HABITO</div>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: estudar Spring Boot" style={inputStyle} />
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)} style={inputStyle}>
            <option value="daily">Diario</option>
            <option value="weekdays">Dias uteis</option>
            <option value="weekly">Semanal</option>
          </select>
          <input value={icon} onChange={(event) => setIcon(event.target.value.slice(0, 4))} placeholder="Icone" style={inputStyle} />
          <div style={swatchesStyle}>
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`cor ${item}`}
                onClick={() => setColor(item)}
                style={{ ...swatchStyle, background: item, outline: color === item ? "2px solid #fff" : "none" }}
              />
            ))}
          </div>
          <button className="hud-label" disabled={isLoading} onClick={submit} style={buttonStyle}>CRIAR HABITO</button>
          {error && <div style={errorStyle}>{error}</div>}
        </section>

        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>HOJE</div>
          <div style={todayMetricStyle}>
            {summary?.todayCompleted ?? 0}/{summary?.todayTotal ?? 0}
          </div>
          <div style={mutedStyle}>habitos concluidos</div>
          <div style={{ height: 18 }} />
          <div className="hud-label" style={labelStyle}>STREAK EM RISCO</div>
          {(summary?.streakAtRisk.length ?? 0) === 0 ? (
            <div style={mutedStyle}>Nenhum streak em risco agora.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {summary?.streakAtRisk.map((habit) => (
                <button key={habit.id} className="hud-label" onClick={() => void toggle(habit.id)} style={riskButtonStyle}>
                  {habit.icon} {habit.name} · {habit.streak}d
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
          <div className="hud-label" style={labelStyle}>GRID DE HABITOS</div>
          <div style={habitGridStyle}>
            {(summary?.habits ?? []).map((habit) => (
              <HabitCard key={habit.id} habit={habit} onToggle={toggle} onRemove={remove} />
            ))}
            {(summary?.habits.length ?? 0) === 0 && <div style={mutedStyle}>Crie o primeiro habito para iniciar o tracking.</div>}
          </div>
        </section>
      </div>
    </ModuleShell>
  );
}

function HabitCard({
  habit,
  onToggle,
  onRemove,
}: {
  habit: HabitWithLogs;
  onToggle: (id: string, date?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}): JSX.Element {
  return (
    <div style={{ ...cardStyle, borderColor: `${habit.color}33` }}>
      <div style={cardHeaderStyle}>
        <div>
          <div style={{ color: habit.color, fontSize: 22 }}>{habit.icon}</div>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>{habit.name}</div>
          <div style={mutedStyle}>{habit.frequency}</div>
        </div>
        <button type="button" onClick={() => void onRemove(habit.id)} style={removeButtonStyle}>×</button>
      </div>
          <ContributionGrid habit={habit} onToggle={onToggle} />
          <div style={todayHintStyle}>hoje fica no ultimo quadrado</div>
      <div style={streakRowStyle}>
        <span>streak <b style={{ color: habit.color }}>{habit.streak}</b></span>
        <span>recorde <b style={{ color: habit.color }}>{habit.bestStreak}</b></span>
      </div>
    </div>
  );
}

function ContributionGrid({ habit, onToggle }: { habit: HabitWithLogs; onToggle: (id: string, date?: string) => Promise<void> }): JSX.Element {
  const completed = new Set(habit.logs.filter((log) => log.completed).map((log) => log.date.slice(0, 10)));
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (41 - index));
    return date;
  });
  return (
    <div style={dotsGridStyle}>
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const done = completed.has(key);
        return (
          <button
            key={key}
            type="button"
            title={day.toLocaleDateString("pt-BR")}
            onClick={() => void onToggle(habit.id, day.toISOString())}
            style={{
              ...dotStyle,
              background: done ? habit.color : "rgba(255,255,255,0.06)",
              boxShadow: done ? `0 0 8px ${habit.color}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

const layoutStyle: CSSProperties = { maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 };
const panelStyle: CSSProperties = { padding: 16, border: `1px solid ${COLOR}18`, borderRadius: 8, background: "rgba(10,15,26,0.72)" };
const labelStyle: CSSProperties = { color: COLOR, fontSize: 10, letterSpacing: "0.12em", marginBottom: 12 };
const mutedStyle: CSSProperties = { color: "rgba(255,255,255,0.38)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" };
const inputStyle: CSSProperties = { width: "100%", padding: 10, marginBottom: 10, background: "rgba(255,255,255,0.035)", border: `1px solid ${COLOR}24`, borderRadius: 6, color: "#fff", fontSize: 13 };
const swatchesStyle: CSSProperties = { display: "flex", gap: 8, marginBottom: 12 };
const swatchStyle: CSSProperties = { width: 24, height: 24, borderRadius: 999, border: "1px solid rgba(255,255,255,0.24)", cursor: "pointer" };
const buttonStyle: CSSProperties = { width: "100%", padding: 11, background: "rgba(16,185,129,0.14)", border: `1px solid ${COLOR}55`, color: COLOR, borderRadius: 6, cursor: "pointer", fontSize: 10 };
const riskButtonStyle: CSSProperties = { ...buttonStyle, textAlign: "left", color: "#F59E0B", borderColor: "#F59E0B55", background: "rgba(245,158,11,0.08)" };
const todayMetricStyle: CSSProperties = { color: COLOR, fontSize: 46, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 };
const habitGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const cardStyle: CSSProperties = { padding: 14, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "rgba(255,255,255,0.025)" };
const cardHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14 };
const removeButtonStyle: CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.35)", cursor: "pointer" };
const dotsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(14, 13px)", gap: 5, marginBottom: 12 };
const dotStyle: CSSProperties = { width: 13, height: 13, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", padding: 0 };
const streakRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.55)", fontSize: 12 };
const todayHintStyle: CSSProperties = { ...mutedStyle, marginBottom: 8 };
const errorStyle: CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 10 };
