import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useEnergyHeatmap, useEnergyToday, useLogEnergy } from "../../hooks/modules/useHealth.js";

const PRIMARY = "#10B981";

function colorForValue(v: number): string {
  if (v <= 3) return "rgba(239,68,68,0.55)";
  if (v <= 5) return "rgba(245,158,11,0.55)";
  if (v <= 7) return "rgba(0,212,255,0.55)";
  return "rgba(16,185,129,0.75)";
}

export function HealthPage(): JSX.Element {
  const [value, setValue] = useState(7);
  const [note, setNote] = useState("");
  const log = useLogEnergy();
  const { data: today } = useEnergyToday();
  const { data: heatmap } = useEnergyHeatmap();

  const handleLog = (): void => {
    log.mutate(
      { value, note: note.trim() || undefined },
      {
        onSuccess: () => setNote(""),
      },
    );
  };

  // Heatmap grid: 7 dias x 24 horas
  const cellMap = new Map<string, number>();
  for (const c of heatmap?.cells ?? []) {
    cellMap.set(`${c.date}|${c.hour}`, c.avg);
  }
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <ModuleShell icon="♡" label="SAÚDE" sub="Energia · Padrões · Recuperação" color={PRIMARY}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Logger */}
        <div
          style={{
            padding: 18,
            marginBottom: 20,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${PRIMARY}30`,
            borderRadius: 10,
          }}
        >
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, marginBottom: 10 }}>
            ◉ COMO TÁ A ENERGIA AGORA?
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => setValue(n)}
                style={{
                  width: 36,
                  height: 36,
                  fontSize: 13,
                  fontFamily: "'Share Tech Mono', monospace",
                  background: value === n ? colorForValue(n) : "rgba(255,255,255,0.02)",
                  border: `1px solid ${value === n ? PRIMARY : "rgba(255,255,255,0.08)"}`,
                  color: value === n ? "#fff" : "rgba(255,255,255,0.5)",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontWeight: value === n ? 700 : 400,
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota opcional (ex: 'pós-almoço', 'cansada')"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontFamily: "'Rajdhani', sans-serif",
              outline: "none",
              marginBottom: 10,
            }}
          />
          <button
            onClick={handleLog}
            disabled={log.isPending}
            className="hud-label"
            style={{
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

        {/* Today */}
        {today && today.length > 0 && (
          <div
            style={{
              padding: 16,
              marginBottom: 20,
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
            }}
          >
            <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
              HOJE · {today.length} REGISTROS
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {today.map((p) => (
                <div
                  key={p.id}
                  title={p.note ?? ""}
                  style={{
                    padding: "4px 8px",
                    background: colorForValue(p.value),
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "'Share Tech Mono', monospace",
                    color: "#fff",
                  }}
                >
                  {new Date(p.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {p.value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heatmap */}
        <div
          style={{
            padding: 16,
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 8,
          }}
        >
          <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
            HEATMAP · 7 DIAS × 24 HORAS
          </div>
          {heatmap?.lowEnergyHour !== null && heatmap?.lowEnergyHour !== undefined && (
            <div
              style={{
                fontSize: 11,
                color: "#F59E0B",
                marginBottom: 12,
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              ⚠ Padrão detectado: energia baixa frequente às {heatmap.lowEnergyHour}h
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {days.map((d) => (
              <div key={d} style={{ display: "flex", gap: 2, alignItems: "center" }}>
                <span
                  style={{
                    width: 55,
                    fontSize: 9,
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                >
                  {d.slice(5)}
                </span>
                {Array.from({ length: 24 }).map((_, h) => {
                  const v = cellMap.get(`${d}|${h}`);
                  return (
                    <div
                      key={h}
                      title={v ? `${d} ${h}h: ${v.toFixed(1)}` : `${d} ${h}h: sem dados`}
                      style={{
                        flex: 1,
                        height: 18,
                        background: v ? colorForValue(Math.round(v)) : "rgba(255,255,255,0.03)",
                        borderRadius: 2,
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <div
              style={{
                display: "flex",
                gap: 2,
                paddingLeft: 57,
                marginTop: 4,
                fontSize: 8,
                color: "rgba(255,255,255,0.2)",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              {[0, 6, 12, 18].map((h) => (
                <span key={h} style={{ flex: h === 0 ? "1 0 calc(25%)" : "1 0 25%" }}>
                  {h.toString().padStart(2, "0")}h
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
