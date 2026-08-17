import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DocAnalysis } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useAnalyzeDoc,
  useAnalyzeDriveDoc,
  useRecentDriveFiles,
  useUploadPdf,
  useDocHistory,
  useDeleteDocAnalysis,
} from "../../hooks/modules/useDocs.js";

const PURPLE = "#7C3AED";
const CYAN   = "#00D4FF";
const GREEN  = "#10B981";
const GOLD   = "#F59E0B";
const RED    = "#EF4444";

const LEVEL_COLOR: Record<string, string> = { baixo: GREEN, medio: GOLD, alto: RED };

type Tab = "upload" | "paste" | "drive" | "history";

/* ─── Analysis Result Card ─── */
function AnalysisResult({ analysis, fileName, onClose }: {
  analysis: DocAnalysis;
  fileName?: string;
  onClose?: () => void;
}): JSX.Element {
  const handleExport = (): void => {
    const content = [
      `# Análise ORION${fileName ? ` — ${fileName}` : ""}`,
      `**Categoria:** ${analysis.category}`,
      "",
      "## Resumo",
      analysis.summary,
      "",
      "## Riscos",
      ...analysis.risks.map(r => `- **[${r.level?.toUpperCase()}]** ${r.detail}`),
      "",
      "## Ações Recomendadas",
      ...analysis.actions.map(a => `- ${a}`),
      "",
      "## Perguntas",
      ...analysis.questions.map(q => `- ${q}`),
    ].join("\n");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-orion-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {fileName && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 3 }}>{fileName}</div>}
          <span style={{ fontSize: 9, padding: "3px 9px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}40`, borderRadius: 20, color: PURPLE, fontFamily: "'Share Tech Mono', monospace" }}>
            {analysis.category?.toUpperCase() ?? "DOCUMENTO"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExport}
            style={{ padding: "6px 12px", fontSize: 9, background: `${CYAN}10`, border: `1px solid ${CYAN}30`, color: CYAN, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
            ↓ EXPORTAR .MD
          </button>
          {onClose && (
            <button onClick={onClose}
              style={{ padding: "6px 10px", fontSize: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", borderRadius: 6, cursor: "pointer" }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <section style={{ padding: 16, background: `${PURPLE}06`, border: `1px solid ${PURPLE}20`, borderLeft: `3px solid ${PURPLE}`, borderRadius: 10 }}>
        <div className="hud-label" style={{ fontSize: 8, color: PURPLE, marginBottom: 8 }}>◎ RESUMO EXECUTIVO</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, margin: 0 }}>{analysis.summary}</p>
      </section>

      {/* Risks */}
      {analysis.risks.length > 0 && (
        <section style={{ padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
          <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>⚠ RISCOS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analysis.risks.map((r, i) => {
              const c = LEVEL_COLOR[r.level ?? "medio"] ?? GOLD;
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", background: `${c}06`, borderLeft: `3px solid ${c}`, borderRadius: 6 }}>
                  <span style={{ fontSize: 8, color: c, fontFamily: "'Share Tech Mono', monospace", marginTop: 3, flexShrink: 0 }}>{(r.level ?? "medio").toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{r.detail}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Actions + Questions in grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {analysis.actions.length > 0 && (
          <section style={{ padding: 14, background: `${GREEN}06`, border: `1px solid ${GREEN}18`, borderRadius: 10 }}>
            <div className="hud-label" style={{ fontSize: 8, color: GREEN, marginBottom: 8 }}>▸ AÇÕES</div>
            {analysis.actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: GREEN, fontSize: 10, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{a.title}</span>
              </div>
            ))}
          </section>
        )}
        {analysis.questions.length > 0 && (
          <section style={{ padding: 14, background: `${CYAN}06`, border: `1px solid ${CYAN}18`, borderRadius: 10 }}>
            <div className="hud-label" style={{ fontSize: 8, color: CYAN, marginBottom: 8 }}>? PERGUNTAS</div>
            {analysis.questions.map((q, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: CYAN, fontSize: 10, flexShrink: 0 }}>?</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{q}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Upload Drop Zone ─── */
function UploadZone({ onFile }: { onFile: (f: File) => void }): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? PURPLE : "rgba(255,255,255,0.1)"}`,
        borderRadius: 14,
        padding: "48px 32px",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? `${PURPLE}06` : "rgba(255,255,255,0.015)",
        transition: "all 0.2s",
      }}>
      <input ref={inputRef} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div style={{ fontSize: 32, marginBottom: 12, color: dragging ? PURPLE : "rgba(255,255,255,0.2)" }}>◧</div>
      <div style={{ fontSize: 14, color: dragging ? PURPLE : "rgba(255,255,255,0.55)", fontFamily: "'Rajdhani', sans-serif", marginBottom: 6 }}>
        {dragging ? "Solte o arquivo aqui" : "Arraste um PDF ou TXT"}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace" }}>
        OU CLIQUE PARA SELECIONAR · ATÉ 20MB
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export function DocsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>("upload");
  const [result, setResult]     = useState<{ analysis: DocAnalysis; fileName?: string } | null>(null);
  const [text, setText]         = useState("");
  const [hint, setHint]         = useState("");
  const [driveQ, setDriveQ]     = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const analyzeDoc    = useAnalyzeDoc();
  const analyzeDrive  = useAnalyzeDriveDoc();
  const uploadPdf     = useUploadPdf();
  const recentDrive   = useRecentDriveFiles(driveQ, tab === "drive");
  const history       = useDocHistory(tab === "history");
  const deleteAnalysis = useDeleteDocAnalysis();

  const isLoading = analyzeDoc.isPending || analyzeDrive.isPending || uploadPdf.isPending;

  const handleFile = (file: File): void => {
    uploadPdf.mutate(file, {
      onSuccess: analysis => setResult({ analysis, fileName: file.name }),
    });
  };

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "upload",  label: "⬆ UPLOAD PDF/TXT" },
    { id: "paste",   label: "✎ COLAR TEXTO" },
    { id: "drive",   label: "◧ GOOGLE DRIVE" },
    { id: "history", label: "◎ HISTÓRICO" },
  ];

  return (
    <ModuleShell icon="◎" label="DOCS" sub="Análise · Upload PDF · Histórico" color={PURPLE}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, marginBottom: 18, borderBottom: `1px solid ${PURPLE}15`, paddingBottom: 2, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }} className="hud-label"
              style={{ padding: "8px 14px", fontSize: 9, background: tab === t.id ? `${PURPLE}15` : "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${PURPLE}` : "2px solid transparent", color: tab === t.id ? PURPLE : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── UPLOAD ── */}
        {tab === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!result && !uploadPdf.isPending && (
              <UploadZone onFile={handleFile} />
            )}
            {uploadPdf.isPending && (
              <div style={{ padding: "40px", textAlign: "center", fontSize: 13, color: PURPLE, fontFamily: "'Share Tech Mono', monospace" }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>◌</div>
                EXTRAINDO TEXTO E ANALISANDO...
              </div>
            )}
            {result && <AnalysisResult analysis={result.analysis} fileName={result.fileName} onClose={() => { setResult(null); }} />}
            {uploadPdf.isError && (
              <div style={{ padding: 14, background: `${RED}08`, border: `1px solid ${RED}30`, borderRadius: 8, color: RED, fontSize: 12, fontFamily: "'Share Tech Mono', monospace" }}>
                ✕ {uploadPdf.error?.message ?? "Erro ao processar arquivo"}
              </div>
            )}
          </div>
        )}

        {/* ── PASTE TEXT ── */}
        {tab === "paste" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>TEXTO DO DOCUMENTO</div>
              <textarea
                value={text} onChange={e => setText(e.target.value)}
                placeholder="Cole aqui o texto do contrato, relatório, email, proposta..."
                rows={10}
                style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${PURPLE}20`, borderRadius: 8, color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "'Share Tech Mono', monospace", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
              />
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>{text.length} / 60.000 chars</div>
            </div>
            <div>
              <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>INSTRUÇÃO EXTRA (OPCIONAL)</div>
              <input value={hint} onChange={e => setHint(e.target.value)} placeholder="Ex: foque nos prazos e penalidades..." className="orion-input" />
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }} onClick={() => analyzeDoc.mutate({ text, hint: hint || undefined }, { onSuccess: a => setResult({ analysis: a }) })}
              disabled={text.length < 50 || isLoading}
              style={{ padding: "11px 24px", fontSize: 11, background: `${PURPLE}15`, border: `1px solid ${PURPLE}`, color: PURPLE, borderRadius: 7, cursor: text.length >= 50 ? "pointer" : "not-allowed", opacity: text.length >= 50 ? 1 : 0.4, fontFamily: "'Share Tech Mono', monospace", boxShadow: `0 0 12px ${PURPLE}18` }}>
              {isLoading ? "◌ ANALISANDO..." : "◎ ANALISAR COM ORION"}
            </motion.button>
            {result && <AnalysisResult analysis={result.analysis} onClose={() => setResult(null)} />}
          </div>
        )}

        {/* ── GOOGLE DRIVE ── */}
        {tab === "drive" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={driveQ} onChange={e => setDriveQ(e.target.value)} placeholder="Buscar arquivos no Drive..." className="orion-input" style={{ flex: 1 }} />
            </div>
            {recentDrive.isLoading && (
              <div style={{ textAlign: "center", padding: 20, color: PURPLE, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>◌ CARREGANDO DRIVE...</div>
            )}
            {recentDrive.isError && (
              <div style={{ padding: 12, background: `${RED}08`, border: `1px solid ${RED}30`, borderRadius: 8, color: RED, fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
                Drive não conectado. Conecte em Integrações.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(recentDrive.data ?? []).map(f => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>{f.mimeType}</div>
                  </div>
                  <button
                    onClick={() => analyzeDrive.mutate(f.id, { onSuccess: a => setResult({ analysis: a, fileName: f.name }) })}
                    disabled={analyzeDrive.isPending}
                    style={{ padding: "6px 14px", fontSize: 9, background: `${PURPLE}10`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                    ANALISAR
                  </button>
                </div>
              ))}
            </div>
            {result && <AnalysisResult analysis={result.analysis} fileName={result.fileName} onClose={() => setResult(null)} />}
          </div>
        )}

        {/* ── HISTÓRICO ── */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.isLoading && (
              <div style={{ textAlign: "center", padding: 24, color: PURPLE, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>◌ CARREGANDO...</div>
            )}
            {(history.data ?? []).length === 0 && !history.isLoading && (
              <div style={{ padding: 40, textAlign: "center", border: `1px dashed ${PURPLE}20`, borderRadius: 10, color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                Nenhuma análise salva ainda.<br/>Faça upload de um PDF ou analise um texto.
              </div>
            )}
            {(history.data ?? []).map(entry => (
              <div key={entry.id} style={{ border: `1px solid ${PURPLE}20`, borderRadius: 10, overflow: "hidden" }}>
                <div
                  style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: expandedId === entry.id ? `${PURPLE}08` : "rgba(255,255,255,0.02)" }}
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif" }}>{entry.fileName}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
                      {entry.analysis.category?.toUpperCase()} · {new Date(entry.createdAt).toLocaleDateString("pt-BR")} {new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: PURPLE }}>{expandedId === entry.id ? "▲" : "▼"}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteAnalysis.mutate(entry.id); }}
                      style={{ padding: "4px 8px", fontSize: 9, background: `${RED}10`, border: `1px solid ${RED}30`, color: RED, borderRadius: 4, cursor: "pointer" }}>
                      ×
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === entry.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: "hidden" }}>
                      <div style={{ padding: "0 16px 16px" }}>
                        <AnalysisResult analysis={entry.analysis} fileName={entry.fileName} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModuleChat
        module="docs"
        label="DOCS"
        color={PURPLE}
        welcome="Posso analisar documentos, identificar cláusulas de risco, extrair datas e ações de qualquer texto. Cole um trecho ou pergunte sobre uma análise anterior."
        suggestions={["Quais são os maiores riscos?", "Quais ações devo tomar?", "Resumir em 3 pontos", "Verificar prazos importantes"]}
      />
    </ModuleShell>
  );
}
