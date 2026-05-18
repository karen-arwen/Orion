import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useLogSleep,
  useSleepRecent,
  useSleepStats,
} from "../../hooks/modules/useSleep.js";

const PRIMARY = "#7C3AED";

function combineLocalDateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM → ISO local
  return new Date(`${date}T${time}:00`).toISOString();
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function SleepPage(): JSX.Element {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const [bedDate, setBedDate] = useState(yesterday);
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeDate, setWakeDate] = useState(today);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [quality, setQuality] = useState(3);
  const [notes, setNotes] = useState("");

  const log = useLogSleep();
  const { data: recent } = useSleepRecent();
  const { data: stats } = useSleepStats();

  const handleLog = (): void => {
    log.mutate(
      {
        bedTime: combineLocalDateTime(bedDate, bedTime),
        wakeTime: combineLocalDateTime(wakeDate, wakeTime),
        quality,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => setNotes("") },
    );
  };

  const consistencyColor =
    !stats || stats.consistencyScore < 40
      ? "#EF4444"
      : stats.consistencyScore < 70
      ? "#F59E0B"
      : "#10B981";

  return (
    <ModuleShell icon="☽" label="SLEEP COACH" sub="Rotina · Consistência · Qualidade" color={PRIMARY}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Stats */}
        {stats && stats.samplesLast7Days > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <StatCard
              label="DURAÇÃO MÉDIA"
              value={fmtMin(stats.avgDurationMin)}
              color={stats.avgDurationMin < 420 ? "#EF4444" : "#10B981"}
            />
            <StatCard
              label="QUALIDADE"
              value={`${stats.avgQuality.toFixed(1)} / 5`}
              color={stats.avgQuality < 3 ? "#F59E0B" : "#00D4FF"}
            />
            <StatCard
              label="CONSISTÊNCIA"
              value={`${stats.consistencyScore}%`}
              color={consistencyColor}
            />
          </div>
        )}

        {/* Logger */}
        <div
          style={{
            padding: 16,
            marginBottom: 20,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${PRIMARY}30`,
            borderRadius: 10,
          }}
        >
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, marginBottom: 12 }}>
            ☽ REGISTRAR SONO
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label
                className="hud-label"
                style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}
              >
                DORMI
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="date"
                  value={bedDate}
                  onChange={(e) => setBedDate(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="time"
                  value={bedTime}
                  onChange={(e) => setBedTime(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label
                className="hud-label"
                style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}
              >
                ACORDEI
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="date"
                  value={wakeDate}
                  onChange={(e) => setWakeDate(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label
              className="hud-label"
              style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}
            >
              QUALIDADE
            </label>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuality(n)}
                  style={{
                    flex: 1,
                    padding: 8,
                    fontSize: 14,
                    background: quality === n ? `${PRIMARY}30` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${quality === n ? PRIMARY : "rgba(255,255,255,0.08)"}`,
                    color: quality === n ? PRIMARY : "rgba(255,255,255,0.5)",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  {"★".repeat(n)}
                </button>
              ))}
            </div>
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas opcionais"
            style={inputStyle}
          />
          <button
            onClick={handleLog}
            disabled={log.isPending}
            className="hud-label"
            style={{
              marginTop: 12,
              padding: "8px 14px",
              fontSize: 10,
              background: `${PRIMARY}25`,
              border: `1px solid ${PRIMARY}`,
              color: PRIMARY,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {log.isPending ? "REGISTRANDO…" : "+ REGISTRAR"}
          </button>
        </div>

        {/* Recent logs */}
        {recent && recent.length > 0 && (
          <div
            style={{
              padding: 16,
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
            }}
          >
            <div
              className="hud-label"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}
            >
              ÚLTIMOS REGISTROS · {recent.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.map((r) => {
                const hours = r.durationMin / 60;
                const okHours = hours >= 7;
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: 10,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${okHours ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.25)"}`,
                      borderRadius: 6,
                      fontSize: 11,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace", width: 80 }}>
                      {new Date(r.bedTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.7)" }}>
                      {new Date(r.bedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" → "}
                      {new Date(r.wakeTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span style={{ color: okHours ? "#10B981" : "#F59E0B", fontWeight: 600 }}>
                      {fmtMin(r.durationMin)}
                    </span>
                    <span style={{ color: "#F59E0B" }}>
                      {"★".repeat(r.quality)}
                    </span>
                    {r.notes && (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontStyle: "italic",
                          fontSize: 10,
                          marginLeft: "auto",
                        }}
                      >
                        {r.notes}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 5,
  color: "#fff",
  fontSize: 12,
  fontFamily: "'Share Tech Mono', monospace",
  outline: "none",
  width: "100%",
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${color}25`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
      }}
    >
      <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontFamily: "'Share Tech Mono', monospace",
          color,
          fontWeight: 700,
          textShadow: `0 0 10px ${color}80`,
        }}
      >
        {value}
      </div>
    </div>
  );
}
