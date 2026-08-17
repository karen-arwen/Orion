import { useState } from "react";
import { motion } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useLogSleep, useSleepRecent, useSleepStats } from "../../hooks/modules/useSleep.js";

const PRIMARY = "#7C3AED";

function combineLocalDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? m.toString().padStart(2, "0") + "m" : ""}`;
}

function qualityEmoji(q: number): string {
  return ["", "\u{1F62B}", "\u{1F614}", "\u{1F610}", "\u{1F60A}", "\u{1F634}"][q] ?? "\u{1F610}";
}

function durationColor(min: number): string {
  if (min < 360) return "#EF4444";
  if (min < 420) return "#F59E0B";
  if (min <= 540) return "#10B981";
  return "#3B82F6";
}

const QUICK_PRESETS = [
  { label: "Dormiu cedo", bed: "22:00", wake: "06:00" },
  { label: "Normal", bed: "23:00", wake: "07:00" },
  { label: "Dormiu tarde", bed: "01:00", wake: "08:00" },
  { label: "Madrugou", bed: "23:30", wake: "05:30" },
];

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SleepPage(): JSX.Element {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const [bedDate, setBedDate] = useState(yesterdayStr);
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeDate, setWakeDate] = useState(todayStr);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [quality, setQuality] = useState(3);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"quick" | "manual">("quick");

  const log = useLogSleep();
  const { data: recent } = useSleepRecent();
  const { data: stats } = useSleepStats();

  const handleLog = (): void => {
    const actualBedDate = mode === "quick" ? (parseInt(bedTime.split(":")[0] ?? "23") >= 12 ? yesterdayStr : todayStr) : bedDate;
    log.mutate({ bedTime: combineLocalDateTime(actualBedDate, bedTime), wakeTime: combineLocalDateTime(wakeDate, wakeTime), quality, notes: notes.trim() || undefined }, { onSuccess: () => setNotes("") });
  };

  const applyPreset = (p: typeof QUICK_PRESETS[number]): void => { setBedTime(p.bed); setWakeTime(p.wake); };

  const previewBedDate = mode === "quick" ? (parseInt(bedTime.split(":")[0] ?? "23") >= 12 ? yesterdayStr : todayStr) : bedDate;
  const previewBed = new Date(`${previewBedDate}T${bedTime}:00`);
  const previewWake = new Date(`${wakeDate}T${wakeTime}:00`);
  const previewMin = Math.round((previewWake.getTime() - previewBed.getTime()) / 60_000);
  const previewValid = previewMin > 0 && previewMin < 1440;

  const consistencyColor = !stats || stats.consistencyScore < 40 ? "#EF4444" : stats.consistencyScore < 70 ? "#F59E0B" : "#10B981";

  return (
    <ModuleShell icon="☽" label="SLEEP COACH" sub="Rotina · Consistência · Qualidade" color={PRIMARY}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Stats */}
        {stats && stats.samplesLast7Days > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="DURAÇÃO MÉDIA" value={fmtMin(stats.avgDurationMin)} color={durationColor(stats.avgDurationMin)} sub={stats.avgDurationMin < 420 ? "Abaixo do ideal" : "Faixa ideal"} />
            <StatCard label="QUALIDADE" value={`${stats.avgQuality.toFixed(1)}/5`} color={stats.avgQuality >= 3.5 ? "#10B981" : "#F59E0B"} sub={stats.avgQuality >= 4 ? "Ótima" : "Ok"} />
            <StatCard label="CONSISTÊNCIA" value={`${stats.consistencyScore}%`} color={consistencyColor} sub={stats.consistencyScore >= 70 ? "Horário regular" : "Horário irregular"} />
            <StatCard label="REGISTROS" value={`${stats.samplesLast7Days}`} color="#00D4FF" sub="últimos 7 dias" />
          </div>
        )}

        {/* Registro */}
        <section style={{ padding: 22, marginBottom: 24, background: "linear-gradient(135deg, rgba(124,58,237,0.06), transparent)", border: `1px solid ${PRIMARY}25`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em" }}>☽ REGISTRAR SONO</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["quick", "manual"] as const).map((m) => (<button key={m} onClick={() => setMode(m)} style={{ padding: "4px 10px", fontSize: 9, fontFamily: "'Share Tech Mono', monospace", background: mode === m ? `${PRIMARY}20` : "transparent", border: `1px solid ${mode === m ? PRIMARY : "rgba(255,255,255,0.1)"}`, color: mode === m ? PRIMARY : "rgba(255,255,255,0.4)", borderRadius: 4, cursor: "pointer" }}>{m === "quick" ? "RÁPIDO" : "MANUAL"}</button>))}
            </div>
          </div>

          {mode === "quick" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {QUICK_PRESETS.map((p) => (<motion.button key={p.label} whileHover={{ scale: 1.03 }} onClick={() => applyPreset(p)} style={{ padding: "8px 14px", fontSize: 11, background: `${PRIMARY}10`, border: `1px solid ${PRIMARY}30`, color: "rgba(255,255,255,0.7)", borderRadius: 6, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif" }}>{p.label}<span style={{ display: "block", fontSize: 9, color: `${PRIMARY}99`, marginTop: 2, fontFamily: "'Share Tech Mono', monospace" }}>{p.bed} {"→"} {p.wake}</span></motion.button>))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>DORMI ÀS</label>
              <div style={{ display: "flex", gap: 4 }}>
                {mode === "manual" && (<input type="date" value={bedDate} onChange={(e) => setBedDate(e.target.value)} style={inputStyle} />)}
                <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>ACORDEI ÀS</label>
              <div style={{ display: "flex", gap: 4 }}>
                {mode === "manual" && (<input type="date" value={wakeDate} onChange={(e) => setWakeDate(e.target.value)} style={inputStyle} />)}
                <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {previewValid && (
            <div style={{ padding: "8px 14px", marginBottom: 14, background: `${durationColor(previewMin)}10`, border: `1px solid ${durationColor(previewMin)}25`, borderRadius: 6, textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: durationColor(previewMin), fontWeight: 700 }}>
              {"≈"} {fmtMin(previewMin)} de sono{previewMin < 360 && " · Pouco sono ⚠"}{previewMin >= 420 && previewMin <= 540 && " · Faixa ideal ✓"}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 6 }}>QUALIDADE</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (<motion.button key={n} whileHover={{ scale: 1.08 }} onClick={() => setQuality(n)} style={{ flex: 1, padding: "10px 4px", fontSize: 20, textAlign: "center" as const, background: quality === n ? `${PRIMARY}25` : "rgba(255,255,255,0.02)", border: `1px solid ${quality === n ? PRIMARY : "rgba(255,255,255,0.08)"}`, borderRadius: 8, cursor: "pointer" }}>{qualityEmoji(n)}<div style={{ fontSize: 8, color: quality === n ? PRIMARY : "rgba(255,255,255,0.3)", marginTop: 4 }}>{"★".repeat(n)}</div></motion.button>))}
            </div>
          </div>

          <input value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLog()} placeholder="Como dormiu? (ex: 'acordei no meio', 'sonhei')" style={{ ...inputStyle, marginBottom: 14 }} />
          <motion.button whileHover={{ scale: 1.02 }} onClick={handleLog} disabled={log.isPending || !previewValid} className="hud-label" style={{ padding: "10px 20px", fontSize: 11, background: `${PRIMARY}20`, border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 6, cursor: "pointer", opacity: previewValid ? 1 : 0.4 }}>{log.isPending ? "REGISTRANDO…" : "☽ REGISTRAR SONO"}</motion.button>
        </section>

        {/* Bar chart */}
        {recent && recent.length > 0 && (
          <section style={{ padding: 20, marginBottom: 24, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
            <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", marginBottom: 16 }}>HISTÓRICO VISUAL</div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120, marginBottom: 8 }}>
              {recent.slice().reverse().map((r) => {
                const hours = r.durationMin / 60;
                const pct = Math.min(100, (hours / 10) * 100);
                const date = new Date(r.bedTime);
                const dayName = dayNames[date.getDay()] ?? "";
                return (
                  <div key={r.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div title={`${fmtMin(r.durationMin)} · Q:${r.quality}`} style={{ width: "100%", maxWidth: 36, height: `${pct}%`, minHeight: 4, background: `linear-gradient(180deg, ${durationColor(r.durationMin)}, ${durationColor(r.durationMin)}80)`, borderRadius: "4px 4px 0 0", position: "relative" }}>
                      <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: "rgba(255,255,255,0.5)", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap" }}>{hours.toFixed(1)}h</div>
                    </div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>{dayName}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent detailed */}
        {recent && recent.length > 0 && (
          <section style={{ padding: 20, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, marginBottom: 24 }}>
            <div className="hud-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", marginBottom: 12 }}>DETALHES · {recent.length} REGISTROS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.map((r) => (
                <div key={r.id} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${durationColor(r.durationMin)}18`, borderLeft: `3px solid ${durationColor(r.durationMin)}`, borderRadius: 8, fontSize: 11, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Share Tech Mono', monospace", minWidth: 50 }}>{new Date(r.bedTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.7)" }}>{new Date(r.bedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {"→"} {new Date(r.wakeTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ color: durationColor(r.durationMin), fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{fmtMin(r.durationMin)}</span>
                  <span style={{ fontSize: 14 }}>{qualityEmoji(r.quality)}</span>
                  <span style={{ color: "#F59E0B", fontSize: 10 }}>{"★".repeat(r.quality)}</span>
                  {r.notes && (<span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic", fontSize: 10, marginLeft: "auto" }}>{r.notes}</span>)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dicas */}
        <section style={{ padding: 18, background: "linear-gradient(135deg, rgba(124,58,237,0.05), transparent)", border: `1px solid ${PRIMARY}15`, borderRadius: 12 }}>
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em", marginBottom: 12 }}>{"\u{1F9E0}"} DICAS DO ORION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats && stats.avgDurationMin < 420 && stats.samplesLast7Days > 0 && (<Tip text={`Média de ${fmtMin(stats.avgDurationMin)} — abaixo de 7h. Tente dormir 30min mais cedo.`} color="#EF4444" />)}
            {stats && stats.consistencyScore < 50 && stats.samplesLast7Days > 0 && (<Tip text={`Consistência em ${stats.consistencyScore}%. Dormir no mesmo horário melhora a qualidade.`} color="#F59E0B" />)}
            {stats && stats.avgQuality >= 4 && stats.samplesLast7Days >= 3 && (<Tip text="Qualidade de sono alta! Continue com a rotina atual." color="#10B981" />)}
            {(!stats || stats.samplesLast7Days === 0) && (<Tip text="Registre seu sono por 7 dias e o ORION identifica padrões e dá dicas personalizadas." color="rgba(255,255,255,0.4)" />)}
          </div>
        </section>
      </div>
      <ModuleChat
        module="sleep"
        label="SONO"
        color={PRIMARY}
        welcome="Posso analisar seus padroes de sono, sugerir melhorias e criar uma rotina noturna ideal. Como posso ajudar?"
        suggestions={["Analisar meu sono", "Rotina noturna ideal", "Como dormir melhor", "Consistencia do sono"]}
      />
    </ModuleShell>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'Share Tech Mono', monospace", outline: "none", width: "100%" };

function StatCard(props: { label: string; value: string; color: string; sub: string }): JSX.Element {
  return (<div style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${props.color}20`, borderRadius: 10, textAlign: "center" }}><div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{props.label}</div><div style={{ fontSize: 24, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: props.color, textShadow: `0 0 10px ${props.color}40` }}>{props.value}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{props.sub}</div></div>);
}

function Tip(props: { text: string; color: string }): JSX.Element {
  return (<div style={{ padding: "8px 12px", background: `${props.color}08`, border: `1px solid ${props.color}20`, borderRadius: 6, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{props.text}</div>);
}
