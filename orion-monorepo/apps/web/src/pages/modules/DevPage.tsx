import { useMemo, useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useDevCommand,
  useDevContextMap,
  useDevDiagnosis,
  useDevFile,
  useDevProposal,
  useDevRunbook,
  useDevWorkspace,
} from "../../hooks/modules/useDev.js";
import { TagPill } from "../../components/visual/TagPill.js";
import { RingGauge } from "../../components/visual/RingGauge.js";

const PRIMARY = "#38BDF8";
const ACCENT = "#00D4FF";
const SUCCESS = "#10B981";
const DANGER = "#EF4444";
const WARN = "#F59E0B";

const EXT_COLOR: Record<string, string> = {
  ".ts": "#3178C6",
  ".tsx": "#3178C6",
  ".js": "#F7DF1E",
  ".jsx": "#F7DF1E",
  ".json": WARN,
  ".md": "#A78BFA",
  ".css": "#EC4899",
  ".prisma": "#2D3748",
};

const KIND_COLOR: Record<string, string> = {
  inspect: PRIMARY,
  patch: WARN,
  validate: SUCCESS,
  review: "#7C3AED",
};

/* ═══════════════════════════════════════════════════════════════════
   DEV EXECUTOR — IDE-feel pra aprovacao de patches e comandos.

   Refeito: hero com workspace metrics + status do ultimo run, sidebar
   com file tree colorido por extensao, preview com numero de linhas, tab
   PROPOSTAS unificada (patch/create/replace + comando) com badges de
   status, runbook lateral como timeline com kind chips.
═══════════════════════════════════════════════════════════════════ */

export function DevPage(): JSX.Element {
  const workspace = useDevWorkspace();
  const contextMap = useDevContextMap();
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState<"all" | "ts" | "routes" | "services" | "pages">("all");
  const [draftPath, setDraftPath] = useState("docs/orion-note.md");
  const [draftContent, setDraftContent] = useState("# Nota do Orion\n\n");
  const [proposalMode, setProposalMode] = useState<"patch" | "create" | "replace">("patch");
  const [searchBlock, setSearchBlock] = useState("");
  const [replaceBlock, setReplaceBlock] = useState("");
  const [commandPreset, setCommandPreset] = useState("npm run typecheck --workspace apps/api");
  const [activeTab, setActiveTab] = useState<"propose" | "debug">("propose");

  const file = useDevFile(selected);
  const proposal = useDevProposal();
  const command = useDevCommand();
  const diagnosis = useDevDiagnosis();
  const runbook = useDevRunbook();

  const topExt = useMemo(() => {
    const entries = Object.entries(workspace.data?.counts.byExt ?? {}).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 6);
  }, [workspace.data]);

  const filteredFiles = useMemo(() => {
    const all = workspace.data?.files ?? [];
    if (filter === "all") return all.slice(0, 120);
    if (filter === "ts") return all.filter((f) => f.ext === ".ts" || f.ext === ".tsx").slice(0, 120);
    if (filter === "routes") return all.filter((f) => f.path.includes("/routes/")).slice(0, 120);
    if (filter === "services") return all.filter((f) => f.path.includes("/modules/") && f.path.endsWith(".service.ts")).slice(0, 120);
    if (filter === "pages") return all.filter((f) => f.path.includes("/pages/")).slice(0, 120);
    return all;
  }, [workspace.data, filter]);

  const proposalPath = proposalMode === "patch" && selected ? selected : draftPath;
  const canSubmit =
    !proposal.isPending &&
    (proposalMode === "patch"
      ? proposalPath.trim().length > 0 && searchBlock.length > 0
      : draftPath.trim().length > 0);

  const exitCode = diagnosis.data?.exitCode;
  const lastRunStatus: "idle" | "pass" | "fail" =
    !diagnosis.data || exitCode === null || exitCode === undefined ? "idle"
    : exitCode === 0 ? "pass"
    : "fail";
  const lastRunMeta = {
    idle: { label: "IDLE", color: "rgba(255,255,255,0.4)", icon: "○" },
    pass: { label: "PASS", color: SUCCESS, icon: "◉" },
    fail: { label: "FAIL", color: DANGER, icon: "×" },
  }[lastRunStatus];

  return (
    <ModuleShell icon="</>" label="DEV EXECUTOR" sub="Workspace · diffs aprovados · action queue" color={PRIMARY}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ━━━ HERO ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                WORKSPACE INDEX
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
                <strong style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 30,
                  color: PRIMARY,
                  letterSpacing: "0.06em",
                  textShadow: `0 0 12px ${PRIMARY}66`,
                }}>
                  {workspace.data?.counts.total ?? 0}
                </strong>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>arquivos com escrita protegida</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                {topExt.map(([ext, count]) => (
                  <TagPill
                    key={ext}
                    label={`${ext} · ${count}`}
                    color={EXT_COLOR[ext] ?? "rgba(255,255,255,0.5)"}
                    size="xs"
                  />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <RingGauge
                value={contextMap.data?.totals.apiRoutes ?? 0}
                centerLabel={String(contextMap.data?.totals.apiRoutes ?? 0)}
                topLabel="ROUTES"
                bottomLabel="API"
                color={ACCENT}
                size={70}
                thickness={5}
              />
              <RingGauge
                value={contextMap.data?.totals.webPages ?? 0}
                centerLabel={String(contextMap.data?.totals.webPages ?? 0)}
                topLabel="PAGES"
                bottomLabel="WEB"
                color={PRIMARY}
                size={70}
                thickness={5}
              />
              <RingGauge
                value={contextMap.data?.totals.sharedTypes ?? 0}
                centerLabel={String(contextMap.data?.totals.sharedTypes ?? 0)}
                topLabel="TYPES"
                bottomLabel="SHARED"
                color="#A78BFA"
                size={70}
                thickness={5}
              />
            </div>
          </div>

          <div className="hud-divider" />

          {/* Status do ultimo run */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, color: lastRunMeta.color, textShadow: `0 0 8px ${lastRunMeta.color}` }}>
                {lastRunMeta.icon}
              </span>
              <div>
                <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>
                  ULTIMO RUN APROVADO
                </div>
                <strong style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 14,
                  color: lastRunMeta.color,
                  letterSpacing: "0.06em",
                }}>
                  {diagnosis.data?.label ?? "Sem execucao"} · {lastRunMeta.label}
                </strong>
              </div>
            </div>
            {diagnosis.data?.primaryError && (
              <span style={{
                fontSize: 11,
                color: DANGER,
                fontFamily: "'Share Tech Mono', monospace",
                padding: "4px 8px",
                background: `${DANGER}15`,
                borderRadius: 4,
                border: `1px solid ${DANGER}33`,
                maxWidth: 480,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {diagnosis.data.primaryError}
              </span>
            )}
          </div>
        </section>

        {/* ━━━ FILE BROWSER + PREVIEW ━━━ */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 12 }}>
          {/* File tree */}
          <section className="dash-section" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 8, letterSpacing: "0.22em" }}>
                EXPLORER · {filteredFiles.length}
              </div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {(["all", "ts", "routes", "services", "pages"] as const).map((f) => (
                  <TagPill
                    key={f}
                    label={f.toUpperCase()}
                    color={ACCENT}
                    variant={filter === f ? "solid" : "outline"}
                    active={filter === f}
                    onClick={() => setFilter(f)}
                    size="xs"
                  />
                ))}
              </div>
            </div>
            <div style={{
              maxHeight: 520,
              overflowY: "auto",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {filteredFiles.map((item) => {
                const color = EXT_COLOR[item.ext] ?? "rgba(255,255,255,0.4)";
                const isActive = selected === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => setSelected(item.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      background: isActive ? `${color}22` : "transparent",
                      border: "none",
                      borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
                      color: isActive ? color : "rgba(255,255,255,0.65)",
                      fontSize: 11,
                      letterSpacing: "0.02em",
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      transition: "all 100ms ease",
                    }}
                  >
                    <span style={{ color, minWidth: 38, fontSize: 9, fontWeight: 700 }}>{item.ext}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.path.replace(/^.*\/([^/]+\/[^/]+)$/, "$1")}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                      {Math.round(item.size / 1024)}K
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preview */}
          <section className="dash-section" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.22em" }}>
                  PREVIEW
                </div>
                <code style={{
                  fontSize: 11,
                  color: selected ? ACCENT : "rgba(255,255,255,0.3)",
                  fontFamily: "'Share Tech Mono', monospace",
                  letterSpacing: "0.04em",
                }}>
                  {selected || "(nenhum arquivo selecionado)"}
                </code>
              </div>
              {file.data && (
                <div style={{ display: "flex", gap: 6 }}>
                  <TagPill label={`${file.data.content.split("\n").length} linhas`} color={ACCENT} size="xs" />
                  {file.data.truncated && <TagPill label="TRUNCADO" color={WARN} variant="solid" size="xs" />}
                </div>
              )}
            </div>
            <pre style={{
              padding: 14,
              maxHeight: 520,
              overflow: "auto",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11.5,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.78)",
              background: "rgba(0,0,0,0.2)",
              margin: 0,
              borderRadius: 0,
            }}>
              {file.isFetching ? "◌ Carregando..." : file.data?.content ?? "Selecione um arquivo no explorer pra ver o preview."}
            </pre>
          </section>
        </div>

        {/* ━━━ TABS: PROPOSE / DEBUG ━━━ */}
        <section className="dash-section">
          <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: `1px solid ${PRIMARY}15` }}>
            {[
              { id: "propose" as const, label: "PROPOR MUDANCA", icon: "▷" },
              { id: "debug" as const, label: "AUTO DEBUG", icon: "◇" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="hud-label"
                style={{
                  padding: "10px 18px",
                  background: activeTab === tab.id ? `${PRIMARY}10` : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
                  color: activeTab === tab.id ? PRIMARY : "rgba(255,255,255,0.4)",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  cursor: "pointer",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "propose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Patch proposal */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                  <div>
                    <span className="hud-label" style={{ color: ACCENT, fontSize: 10, letterSpacing: "0.22em" }}>
                      ◆ PATCH PROPOSAL
                    </span>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, maxWidth: 540, lineHeight: 1.4 }}>
                      Manda pra Action Queue. Modo PATCH edita por search/replace e mostra diff antes de gravar.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["patch", "create", "replace"] as const).map((m) => (
                      <TagPill
                        key={m}
                        label={m.toUpperCase()}
                        color={m === "patch" ? ACCENT : m === "create" ? SUCCESS : WARN}
                        variant={proposalMode === m ? "solid" : "outline"}
                        active={proposalMode === m}
                        onClick={() => setProposalMode(m)}
                        size="xs"
                      />
                    ))}
                  </div>
                </div>

                <input
                  className="orion-input"
                  value={proposalPath}
                  onChange={(e) => setDraftPath(e.target.value)}
                  disabled={proposalMode === "patch" && Boolean(selected)}
                  placeholder="path/do/arquivo.ts"
                  style={{ marginBottom: 10, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}
                />

                {proposalMode === "patch" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div className="hud-label" style={{ fontSize: 8, color: DANGER, marginBottom: 4 }}>− BUSCAR</div>
                      <textarea
                        value={searchBlock}
                        onChange={(e) => setSearchBlock(e.target.value)}
                        placeholder="Trecho exato a substituir"
                        rows={8}
                        className="orion-input"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: 11,
                          background: `${DANGER}08`,
                          borderColor: `${DANGER}33`,
                          resize: "vertical",
                          lineHeight: 1.5,
                        }}
                      />
                    </div>
                    <div>
                      <div className="hud-label" style={{ fontSize: 8, color: SUCCESS, marginBottom: 4 }}>+ SUBSTITUIR</div>
                      <textarea
                        value={replaceBlock}
                        onChange={(e) => setReplaceBlock(e.target.value)}
                        placeholder="Texto novo"
                        rows={8}
                        className="orion-input"
                        style={{
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: 11,
                          background: `${SUCCESS}08`,
                          borderColor: `${SUCCESS}33`,
                          resize: "vertical",
                          lineHeight: 1.5,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    rows={10}
                    className="orion-input"
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 11,
                      resize: "vertical",
                      lineHeight: 1.5,
                    }}
                  />
                )}

                <button
                  onClick={() => {
                    proposal.mutate({
                      title: `${proposalMode === "patch" ? "Patch em" : "Atualizar"} ${proposalPath}`,
                      summary: "Proposta criada no Dev Executor.",
                      path: proposalPath,
                      content: proposalMode === "patch" ? undefined : draftContent,
                      mode: proposalMode,
                      operations: proposalMode === "patch" ? [{ search: searchBlock, replace: replaceBlock }] : undefined,
                    });
                  }}
                  disabled={!canSubmit}
                  className="orion-command"
                  style={{
                    color: PRIMARY,
                    borderColor: `${PRIMARY}77`,
                    background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
                    marginTop: 12,
                    fontSize: 11,
                    padding: "10px 16px",
                    boxShadow: canSubmit ? `0 0 12px ${PRIMARY}33` : "none",
                    opacity: canSubmit ? 1 : 0.4,
                  }}
                >
                  {proposal.isPending ? "◌ ENVIANDO..." : "▷ ENVIAR PRA ACTION QUEUE"}
                </button>

                {proposal.data && (
                  <div style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: `${SUCCESS}10`,
                    border: `1px solid ${SUCCESS}33`,
                    borderRadius: 6,
                    fontSize: 11,
                    color: SUCCESS,
                    fontFamily: "'Share Tech Mono', monospace",
                  }}>
                    ◉ Proposta criada · {proposal.data.path} · {proposal.data.mode} · decisao {proposal.data.decisionId.slice(0, 8)}
                  </div>
                )}
              </div>

              <div className="hud-divider" />

              {/* Command proposal */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                  <div>
                    <span className="hud-label" style={{ color: WARN, fontSize: 10, letterSpacing: "0.22em" }}>
                      ⚙ COMMAND PROPOSAL
                    </span>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, lineHeight: 1.4 }}>
                      Permitidos: <code>npm run &lt;script&gt; [args]</code> e <code>git status/diff/log/show/branch</code>.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={commandPreset}
                    onChange={(e) => setCommandPreset(e.target.value)}
                    className="orion-input"
                    style={{ flex: 1, minWidth: 280, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}
                    placeholder="npm run typecheck"
                  />
                  <button
                    onClick={() => {
                      const [cmd, ...args] = commandPreset.trim().split(/\s+/);
                      if (cmd !== "npm" && cmd !== "git") return;
                      command.mutate({
                        title: `Executar ${commandPreset}`,
                        summary: "Comando preparado no Dev Executor.",
                        command: cmd,
                        args,
                      });
                    }}
                    disabled={command.isPending || !/^(npm|git)\s+/.test(commandPreset.trim())}
                    className="orion-command"
                    style={{
                      color: WARN,
                      borderColor: `${WARN}77`,
                      background: `${WARN}14`,
                      fontSize: 11,
                      padding: "10px 16px",
                    }}
                  >
                    {command.isPending ? "◌ ENVIANDO..." : "⚙ PREPARAR COMANDO"}
                  </button>
                </div>
                {command.data && (
                  <div style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: `${SUCCESS}10`,
                    border: `1px solid ${SUCCESS}33`,
                    borderRadius: 6,
                    fontSize: 11,
                    color: SUCCESS,
                    fontFamily: "'Share Tech Mono', monospace",
                  }}>
                    ◉ Comando preparado · {command.data.commandLine} · decisao {command.data.decisionId.slice(0, 8)}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "debug" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Diagnosis */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <span className="hud-label" style={{ color: lastRunMeta.color, fontSize: 10, letterSpacing: "0.22em" }}>
                    ◇ DIAGNOSTICO DA ULTIMA EXECUCAO
                  </span>
                  <TagPill icon={lastRunMeta.icon} label={lastRunMeta.label} color={lastRunMeta.color} variant="solid" />
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.55, marginBottom: 10 }}>
                  {diagnosis.data?.primaryError ?? "Rode um comando aprovado pra gerar diagnostico automatico."}
                </p>

                {(diagnosis.data?.files ?? []).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
                      ARQUIVOS ENVOLVIDOS
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {diagnosis.data!.files.slice(0, 6).map((item) => (
                        <button
                          key={`${item.path}:${item.line ?? ""}`}
                          onClick={() => setSelected(item.path)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "6px 10px",
                            background: `${DANGER}08`,
                            border: `1px solid ${DANGER}22`,
                            borderLeft: `2px solid ${DANGER}`,
                            color: "rgba(255,255,255,0.78)",
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 11,
                            borderRadius: 4,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span>{item.path}{item.line ? `:${item.line}` : ""}</span>
                          {item.code && <span style={{ color: DANGER }}>{item.code}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(diagnosis.data?.suggestedNextSteps ?? []).length > 0 && (
                  <div>
                    <div className="hud-label" style={{ fontSize: 8, color: ACCENT, marginBottom: 6 }}>
                      ▷ PROXIMOS PASSOS SUGERIDOS
                    </div>
                    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      {diagnosis.data!.suggestedNextSteps.slice(0, 4).map((step, i) => (
                        <li key={step} style={{
                          fontSize: 11.5,
                          color: "rgba(255,255,255,0.7)",
                          paddingLeft: 22,
                          position: "relative",
                          lineHeight: 1.5,
                        }}>
                          <span style={{
                            position: "absolute",
                            left: 0,
                            color: ACCENT,
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 10,
                            fontWeight: 700,
                          }}>{String(i + 1).padStart(2, "0")}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Runbook */}
              {(runbook.data?.steps ?? []).length > 0 && (
                <div>
                  <span className="hud-label" style={{ color: "#7C3AED", fontSize: 10, letterSpacing: "0.22em" }}>
                    ◧ DEBUG RUNBOOK
                  </span>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, marginBottom: 10 }}>
                    {runbook.data?.title}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="hud-stagger">
                    {runbook.data!.steps.map((step, i) => {
                      const color = KIND_COLOR[step.kind] ?? PRIMARY;
                      return (
                        <article key={step.id} style={{
                          padding: "10px 12px",
                          borderRadius: 7,
                          border: `1px solid ${color}33`,
                          borderLeft: `2px solid ${color}`,
                          background: `linear-gradient(135deg, ${color}10, transparent 70%)`,
                          display: "flex",
                          gap: 10,
                        }}>
                          <span style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 14,
                            color,
                            minWidth: 24,
                            textShadow: `0 0 4px ${color}`,
                            fontWeight: 700,
                          }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <TagPill label={step.kind} color={color} variant="solid" size="xs" />
                              <strong style={{ fontSize: 12.5, color: "rgba(255,255,255,0.88)" }}>{step.label}</strong>
                            </div>
                            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
                              {step.detail}
                            </p>
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              {step.target && (
                                <button
                                  onClick={() => setSelected(step.target ?? "")}
                                  className="orion-command"
                                  style={{ fontSize: 9, padding: "3px 8px", color: ACCENT, borderColor: `${ACCENT}44` }}
                                >
                                  ABRIR ALVO
                                </button>
                              )}
                              {step.command && (
                                <button
                                  onClick={() => command.mutate(step.command!)}
                                  className="orion-command"
                                  style={{ fontSize: 9, padding: "3px 8px", color: WARN, borderColor: `${WARN}44` }}
                                >
                                  ⚙ PREPARAR COMANDO
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      <ModuleChat
        module="dev"
        label="DEV"
        color={PRIMARY}
        welcome="Posso debugar, revisar codigo, gerar testes, explicar arquitetura e ajudar com deploy. O que precisa?"
        suggestions={["Revisar meu codigo", "Gerar testes", "Debugar erro", "Explicar arquitetura"]}
      />
    </ModuleShell>
  );
}
