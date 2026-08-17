import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinanceTransactionType } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useFinanceSummary,
  useFinanceMonthData,
  useCreateFinanceTransaction,
  useCreateFinanceSubscription,
  useCreateFinanceGoal,
  useUpdateFinanceGoal,
  useUpsertBudget,
  useDeleteBudget,
  useImportCsv,
} from "../../hooks/modules/useFinance.js";

const GOLD   = "#F59E0B";
const GREEN  = "#10B981";
const RED    = "#EF4444";
const CYAN   = "#00D4FF";
const PURPLE = "#7C3AED";

const CAT_COLORS = [GOLD, CYAN, GREEN, PURPLE, "#EC4899", "#F97316", "#8B5CF6", "#14B8A6"];
const CATEGORIES = ["alimentação","transporte","saúde","lazer","moradia","educação","roupas","assinatura","investimento","outros"];

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function toMon(d: Date): string { return d.toISOString().slice(0, 7); }

/* ─────────── DONUT CHART ─────────── */
function DonutChart({ slices, size = 140 }: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
}): JSX.Element {
  const total = slices.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)" }} />;

  const cx = size / 2, cy = size / 2, r = size * 0.4, sw = size * 0.14;
  let angle = -Math.PI / 2;
  const arcs: JSX.Element[] = [];

  slices.forEach((s, i) => {
    const frac = s.value / total;
    const sweep = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    arcs.push(
      <path key={i}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none" stroke={s.color} strokeWidth={sw} strokeLinecap="butt"
        style={{ filter: `drop-shadow(0 0 4px ${s.color}66)` }}
      />
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
      {arcs}
    </svg>
  );
}

/* ─────────── LINE CHART ─────────── */
function LineChart({ data, color = GOLD }: {
  data: Array<{ date: string; value: number }>;
  color?: string;
}): JSX.Element {
  const W = 340, H = 80;
  if (data.length < 2) return (
    <div style={{ width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>SEM DADOS</div>
  );
  const max = Math.max(...data.map(d => d.value), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (W - 20) + 10;
    const y = H - 10 - ((d.value / max) * (H - 20));
    return `${x},${y}`;
  }).join(" ");

  // Fill area
  const firstX = 10, lastX = (W - 20) + 10;
  const fillPts = `${firstX},${H - 10} ${pts} ${lastX},${H - 10}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polygon points={fillPts} fill={`${color}15`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * (W - 20) + 10;
        const y = H - 10 - ((d.value / max) * (H - 20));
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} style={{ filter: `drop-shadow(0 0 2px ${color})` }} />;
      })}
    </svg>
  );
}

/* ─────────── BUDGET BAR ─────────── */
function BudgetBar({ category, budgetAmount, spentAmount, pct, status, onDelete }: {
  category: string; budgetAmount: number; spentAmount: number; pct: number;
  status: "ok" | "warning" | "over"; onDelete: () => void;
}): JSX.Element {
  const barColor = status === "over" ? RED : status === "warning" ? GOLD : GREEN;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{category}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: barColor, fontFamily: "'Share Tech Mono', monospace" }}>{brl(spentAmount)} / {brl(budgetAmount)}</span>
          <button onClick={onDelete} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 10 }}>×</button>
        </div>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ height: "100%", background: barColor, borderRadius: 3, boxShadow: `0 0 6px ${barColor}66` }} />
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Share Tech Mono', monospace" }}>
        {pct}% usado{status === "over" && <span style={{ color: RED }}> · ESTOURADO</span>}
        {status === "warning" && <span style={{ color: GOLD }}> · ATENÇÃO</span>}
      </div>
    </div>
  );
}

type Tab = "visao" | "lancamentos" | "budget" | "metas" | "assinaturas" | "csv";

export function FinancePage(): JSX.Element {
  const [tab, setTab]     = useState<Tab>("visao");
  const [month, setMonth] = useState<string>(toMon(new Date()));

  const summary   = useFinanceSummary();
  const monthData = useFinanceMonthData(month);
  const createTx  = useCreateFinanceTransaction();
  const createSub = useCreateFinanceSubscription();
  const createGoal = useCreateFinanceGoal();
  const updateGoal = useUpdateFinanceGoal();
  const upsertBudget = useUpsertBudget();
  const deleteBudget = useDeleteBudget();
  const importCsv = useImportCsv();

  const fileRef = useRef<HTMLInputElement>(null);
  const data = summary.data;
  const md   = monthData.data;

  // Transaction form
  const [txType, setTxType]       = useState<FinanceTransactionType>("expense");
  const [txAmount, setTxAmount]   = useState("");
  const [txCat, setTxCat]         = useState("alimentação");
  const [txMerchant, setTxMerchant] = useState("");

  // Budget form
  const [budgetCat, setBudgetCat]   = useState("alimentação");
  const [budgetAmt, setBudgetAmt]   = useState("");

  // Sub form
  const [subName, setSubName]   = useState("");
  const [subAmt, setSubAmt]     = useState("");

  // Goal form
  const [goalName, setGoalName]     = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  // CSV import
  const [csvText, setCsvText]       = useState("");
  const [csvResult, setCsvResult]   = useState<{ imported: number; errors: number } | null>(null);

  const addTx = (): void => {
    const n = Number(txAmount.replace(",", "."));
    if (!n || n <= 0) return;
    createTx.mutate({ type: txType, amount: n, category: txCat, merchant: txMerchant || undefined },
      { onSuccess: () => { setTxAmount(""); setTxMerchant(""); } });
  };

  const addSub = (): void => {
    const n = Number(subAmt.replace(",", "."));
    if (!subName.trim() || !n) return;
    createSub.mutate({ name: subName.trim(), amount: n, category: "assinatura" },
      { onSuccess: () => { setSubName(""); setSubAmt(""); } });
  };

  const addGoal = (): void => {
    const n = Number(goalTarget.replace(",", "."));
    if (!goalName.trim() || !n) return;
    createGoal.mutate({ name: goalName.trim(), targetAmount: n },
      { onSuccess: () => { setGoalName(""); setGoalTarget(""); } });
  };

  const addBudget = (): void => {
    const n = Number(budgetAmt.replace(",", "."));
    if (!n || n <= 0) return;
    upsertBudget.mutate({ month, category: budgetCat, amount: n },
      { onSuccess: () => setBudgetAmt("") });
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCsvText(ev.target?.result as string); };
    reader.readAsText(file);
  };

  const handleCsvImport = (): void => {
    if (!csvText.trim()) return;
    importCsv.mutate(csvText, { onSuccess: (r) => { setCsvResult(r); setCsvText(""); } });
  };

  // Chart data from monthData
  const lineData = (md?.dailySpend ?? []).map(d => ({ date: d.date, value: d.expense }));
  const donutSlices = (md?.categoryBreakdown ?? data?.topCategories ?? [])
    .slice(0, 8)
    .map((c, i) => ({ label: c.category, value: c.amount, color: CAT_COLORS[i % CAT_COLORS.length]! }));

  const runwayColor = data?.runwaySignal === "stable" ? GREEN : data?.runwaySignal === "attention" ? GOLD : RED;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "visao",         label: "◈ VISÃO" },
    { id: "lancamentos",   label: "± LANÇAMENTOS" },
    { id: "budget",        label: "◧ BUDGET" },
    { id: "metas",         label: "▲ METAS" },
    { id: "assinaturas",   label: "↻ ASSINATURAS" },
    { id: "csv",           label: "⬆ IMPORTAR CSV" },
  ];

  return (
    <ModuleShell icon="◈" label="FINANÇAS" sub="Gastos · Budget · Gráficos · Metas" color={GOLD}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Month selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>MÊS:</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: `1px solid ${GOLD}33`, borderRadius: 5, color: GOLD, fontSize: 12, fontFamily: "'Share Tech Mono', monospace", colorScheme: "dark", cursor: "pointer" }} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, marginBottom: 16, borderBottom: `1px solid ${GOLD}15`, paddingBottom: 2, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="hud-label"
              style={{ padding: "7px 12px", fontSize: 9, background: tab === t.id ? `${GOLD}15` : "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === t.id ? GOLD : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── VISÃO GERAL ── */}
        {tab === "visao" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {[
                { label: "RECEITA",       value: brl(data?.monthIncome ?? 0),    color: GREEN },
                { label: "GASTOS",        value: brl(data?.monthExpense ?? 0),   color: RED },
                { label: "SALDO",         value: brl(data?.monthBalance ?? 0),   color: (data?.monthBalance ?? 0) >= 0 ? GREEN : RED },
                { label: "FIXOS/MÊS",     value: brl(data?.recurringMonthly ?? 0), color: GOLD },
                { label: "SINAL",         value: data?.runwaySignal?.toUpperCase() ?? "—", color: runwayColor },
              ].map(k => (
                <div key={k.label} style={{ padding: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${k.color}18`, borderRadius: 10, textAlign: "center" }}>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontFamily: "'Share Tech Mono', monospace", color: k.color, fontWeight: 700 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Donut */}
              <section style={{ padding: 18, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 12 }}>
                <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 14 }}>◎ GASTOS POR CATEGORIA</div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <DonutChart slices={donutSlices} size={130} />
                  <div style={{ flex: 1, minWidth: 120 }}>
                    {donutSlices.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", flex: 1, textTransform: "capitalize" }}>{s.label}</span>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'Share Tech Mono', monospace" }}>{brl(s.value)}</span>
                      </div>
                    ))}
                    {donutSlices.length === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Sem dados para {month}</div>}
                  </div>
                </div>
              </section>

              {/* Line */}
              <section style={{ padding: 18, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 12 }}>
                <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 14 }}>▸ GASTOS DIÁRIOS — {month}</div>
                {monthData.isLoading
                  ? <div className="hud-label" style={{ color: "rgba(255,255,255,0.3)" }}>◌ carregando...</div>
                  : <LineChart data={lineData} color={GOLD} />
                }
                {lineData.length > 0 && (
                  <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>
                      PICO: {brl(Math.max(...lineData.map(d => d.value)))}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>
                      MÉDIA/DIA: {brl(lineData.reduce((s, d) => s + d.value, 0) / (lineData.length || 1))}
                    </span>
                  </div>
                )}
              </section>
            </div>

            {/* Insights */}
            {(data?.insights ?? []).length > 0 && (
              <section style={{ padding: 16, background: `${PURPLE}08`, border: `1px solid ${PURPLE}25`, borderRadius: 10 }}>
                <div className="hud-label" style={{ fontSize: 9, color: PURPLE, marginBottom: 10 }}>✦ INSIGHTS ORION</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data!.insights.map(ins => {
                    const c = ins.severity === "high" ? RED : ins.severity === "medium" ? GOLD : CYAN;
                    return (
                      <div key={ins.id} style={{ padding: "10px 14px", background: `${c}06`, border: `1px solid ${c}22`, borderLeft: `3px solid ${c}`, borderRadius: 7 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 3 }}>{ins.title}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{ins.detail}</div>
                        {ins.action && <div style={{ fontSize: 10, color: c, marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>→ {ins.action}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recent transactions */}
            {(data?.recentTransactions ?? []).length > 0 && (
              <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 10 }}>
                <div className="hud-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>RECENTES</div>
                {data!.recentTransactions.slice(0, 8).map(tx => (
                  <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                    <div>
                      <span style={{ color: "rgba(255,255,255,0.75)" }}>{tx.merchant || tx.category}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>{tx.category}</span>
                    </div>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", color: tx.type === "expense" ? RED : GREEN }}>{tx.type === "expense" ? "-" : "+"}{brl(tx.amount)}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {/* ── LANÇAMENTOS ── */}
        {tab === "lancamentos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 10 }}>
              <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 14 }}>± NOVO LANÇAMENTO</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {(["expense","income"] as const).map(t => (
                  <button key={t} onClick={() => setTxType(t)}
                    style={{ padding: "7px 14px", fontSize: 10, background: txType === t ? (t === "expense" ? `${RED}18` : `${GREEN}18`) : "transparent", border: `1px solid ${txType === t ? (t === "expense" ? RED : GREEN) : "rgba(255,255,255,0.1)"}`, color: txType === t ? (t === "expense" ? RED : GREEN) : "rgba(255,255,255,0.4)", borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                    {t === "expense" ? "− DESPESA" : "+ RECEITA"}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
                <div>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>VALOR (R$)</div>
                  <input value={txAmount} onChange={e => setTxAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && addTx()}
                    placeholder="0,00" className="orion-input" />
                </div>
                <div>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>CATEGORIA</div>
                  <select value={txCat} onChange={e => setTxCat(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", outline: "none" }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>ESTABELECIMENTO</div>
                  <input value={txMerchant} onChange={e => setTxMerchant(e.target.value)} placeholder="opcional"
                    className="orion-input" />
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} onClick={addTx} disabled={!txAmount || createTx.isPending}
                style={{ padding: "9px 20px", fontSize: 10, background: txType === "expense" ? `${RED}18` : `${GREEN}18`, border: `1px solid ${txType === "expense" ? RED : GREEN}`, color: txType === "expense" ? RED : GREEN, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                {createTx.isPending ? "◌ SALVANDO..." : "+ REGISTRAR"}
              </motion.button>
            </section>
          </div>
        )}

        {/* ── BUDGET ── */}
        {tab === "budget" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 10 }}>
              <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 14 }}>◧ DEFINIR LIMITE — {month}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>CATEGORIA</div>
                  <select value={budgetCat} onChange={e => setBudgetCat(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", outline: "none" }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>LIMITE (R$)</div>
                  <input value={budgetAmt} onChange={e => setBudgetAmt(e.target.value)} onKeyDown={e => e.key === "Enter" && addBudget()}
                    placeholder="500,00" className="orion-input" />
                </div>
                <button onClick={addBudget} disabled={!budgetAmt || upsertBudget.isPending}
                  style={{ padding: "9px 16px", fontSize: 10, background: `${GOLD}15`, border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  {upsertBudget.isPending ? "◌" : "DEFINIR"}
                </button>
              </div>
            </section>

            {monthData.isLoading
              ? <div className="hud-label" style={{ color: "rgba(255,255,255,0.3)" }}>◌ carregando...</div>
              : (md?.budgets ?? []).length === 0
              ? <div style={{ padding: 32, textAlign: "center", border: `1px dashed ${GOLD}20`, borderRadius: 10, color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Nenhum budget definido para {month}. Defina limites acima.</div>
              : <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}15`, borderRadius: 10 }}>
                  <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 14 }}>LIMITES vs GASTOS</div>
                  {(md?.budgets ?? []).map(b => (
                    <BudgetBar key={b.category} {...b}
                      onDelete={() => deleteBudget.mutate({ month, category: b.category })} />
                  ))}
                </section>
            }
          </div>
        )}

        {/* ── METAS ── */}
        {tab === "metas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 10 }}>
              <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 12 }}>▲ NOVA META</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Nome da meta"
                    className="orion-input" />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <input value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="Valor alvo (R$)"
                    className="orion-input" />
                </div>
                <button onClick={addGoal} disabled={!goalName || !goalTarget || createGoal.isPending}
                  style={{ padding: "9px 16px", fontSize: 10, background: `${GREEN}15`, border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  + CRIAR
                </button>
              </div>
            </section>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(data?.goals ?? []).filter(g => g.status === "active").map(g => {
                const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
                const remaining = g.targetAmount - g.currentAmount;
                return (
                  <div key={g.id} style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${GREEN}18`, borderLeft: `3px solid ${GREEN}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <strong style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontFamily: "'Share Tech Mono', monospace" }}>{g.name}</strong>
                      <span style={{ fontSize: 11, color: GREEN, fontFamily: "'Share Tech Mono', monospace" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.8 }}
                        style={{ height: "100%", background: `linear-gradient(90deg, ${GREEN}, ${CYAN})`, borderRadius: 3 }} />
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>
                      <span>ATUAL: {brl(g.currentAmount)}</span>
                      <span>ALVO: {brl(g.targetAmount)}</span>
                      <span>FALTAM: {brl(remaining)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <input placeholder="Depositar R$" style={{ flex: 1, padding: "5px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#fff", fontSize: 11, fontFamily: "'Rajdhani', sans-serif", outline: "none" }}
                        id={`goal-dep-${g.id}`} />
                      <button onClick={() => {
                        const inp = document.getElementById(`goal-dep-${g.id}`) as HTMLInputElement;
                        const n = Number(inp.value.replace(",", "."));
                        if (n > 0) updateGoal.mutate({ id: g.id, input: { currentAmount: g.currentAmount + n } });
                        inp.value = "";
                      }} style={{ padding: "5px 12px", fontSize: 9, background: `${GREEN}12`, border: `1px solid ${GREEN}44`, color: GREEN, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                        + DEPOSITAR
                      </button>
                    </div>
                  </div>
                );
              })}
              {(data?.goals ?? []).length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: `1px dashed ${GREEN}20`, borderRadius: 10, color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Nenhuma meta ativa. Crie uma acima.</div>
              )}
            </div>
          </div>
        )}

        {/* ── ASSINATURAS ── */}
        {tab === "assinaturas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 10 }}>
              <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 12 }}>↻ NOVA ASSINATURA</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 2 }}>
                  <input value={subName} onChange={e => setSubName(e.target.value)} placeholder="Netflix, Spotify..."
                    className="orion-input" />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <input value={subAmt} onChange={e => setSubAmt(e.target.value)} placeholder="R$/mês"
                    className="orion-input" />
                </div>
                <button onClick={addSub} disabled={!subName || !subAmt || createSub.isPending}
                  style={{ padding: "9px 16px", fontSize: 10, background: `${GOLD}15`, border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  + ADICIONAR
                </button>
              </div>
            </section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {(data?.subscriptions ?? []).filter(s => s.active).map(s => (
                <div key={s.id} style={{ padding: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderLeft: `3px solid ${GOLD}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 5 }}>{s.name}</div>
                  <div style={{ fontSize: 16, color: GOLD, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>{brl(s.amount)}/mês</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{s.category}</div>
                </div>
              ))}
              {(data?.subscriptions ?? []).length === 0 && (
                <div style={{ padding: 28, textAlign: "center", border: `1px dashed ${GOLD}20`, borderRadius: 10, color: "rgba(255,255,255,0.25)", fontSize: 12, gridColumn: "1/-1" }}>Nenhuma assinatura cadastrada.</div>
              )}
            </div>
            {(data?.subscriptions ?? []).filter(s => s.active).length > 0 && (
              <div style={{ padding: 12, background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderRadius: 8, textAlign: "right" }}>
                <span className="hud-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>TOTAL MENSAL: </span>
                <span style={{ fontSize: 16, color: GOLD, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>
                  {brl(data!.subscriptions.filter(s => s.active).reduce((sum, s) => sum + s.amount, 0))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── CSV IMPORT ── */}
        {tab === "csv" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={{ padding: 18, background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}18`, borderRadius: 10 }}>
              <div className="hud-label" style={{ fontSize: 9, color: GOLD, marginBottom: 12 }}>⬆ IMPORTAR EXTRATO CSV</div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 14, lineHeight: 1.6 }}>
                Suporta CSV de qualquer banco. Colunas detectadas automaticamente: <code style={{ color: GOLD }}>date, amount, category, merchant, type, note</code>.
                Separadores por vírgula ou ponto-e-vírgula.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCsvFile}
                  style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: "9px 16px", fontSize: 10, background: `${CYAN}10`, border: `1px solid ${CYAN}44`, color: CYAN, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  📂 SELECIONAR ARQUIVO
                </button>
              </div>
              <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8}
                placeholder={"data,valor,categoria,estabelecimento\n2026-06-01,45.90,alimentação,Padaria\n2026-06-02,120.00,transporte,Uber\n..."}
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, marginBottom: 12 }} />
              <motion.button whileHover={{ scale: 1.02 }} onClick={handleCsvImport} disabled={!csvText.trim() || importCsv.isPending}
                style={{ padding: "10px 20px", fontSize: 11, background: `${GOLD}18`, border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, cursor: csvText.trim() ? "pointer" : "not-allowed", opacity: csvText.trim() ? 1 : 0.4, fontFamily: "'Share Tech Mono', monospace", boxShadow: `0 0 10px ${GOLD}22` }}>
                {importCsv.isPending ? "◌ IMPORTANDO..." : "⬆ IMPORTAR AGORA"}
              </motion.button>
            </section>

            <AnimatePresence>
              {csvResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ padding: 16, background: `${GREEN}08`, border: `1px solid ${GREEN}33`, borderRadius: 10, display: "flex", gap: 20, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 24, color: GREEN, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>{csvResult.imported}</div>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>IMPORTADOS</div>
                  </div>
                  {csvResult.errors > 0 && (
                    <div>
                      <div style={{ fontSize: 24, color: "#F59E0B", fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>{csvResult.errors}</div>
                      <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>ERROS</div>
                    </div>
                  )}
                  <button onClick={() => setCsvResult(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>×</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ModuleChat
        module="finance"
        label="FINANÇAS"
        color={GOLD}
        welcome="Posso analisar seus gastos, comparar com meses anteriores, identificar onde economizar e projetar seu orçamento. O que quer saber?"
        suggestions={["Analisar gastos do mês", "Onde posso economizar?", "Comparar com mês passado", "Previsão fim do mês"]}
      />
    </ModuleShell>
  );
}
