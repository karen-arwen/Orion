import { useState } from "react";
import type { DocAnalysis } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useAnalyzeDoc,
  useAnalyzeDriveDoc,
  useRecentDriveFiles,
} from "../../hooks/modules/useDocs.js";

const PRIMARY = "#7C3AED";

const LEVEL_COLOR: Record<"baixo" | "medio" | "alto", string> = {
  baixo: "#10B981",
  medio: "#F59E0B",
  alto: "#EF4444",
};

export function DocsPage(): JSX.Element {
  const [tab, setTab] = useState<"paste" | "drive">("paste");
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [driveQuery, setDriveQuery] = useState("");

  const analyze = useAnalyzeDoc();
  const analyzeDrive = useAnalyzeDriveDoc();
  const recent = useRecentDriveFiles(driveQuery, tab === "drive");

  const result = analyze.data ?? analyzeDrive.data;
  const error = analyze.error ?? analyzeDrive.error;
  const loading = analyze.isPending || analyzeDrive.isPending;

  const handleAnalyzePaste = (): void => {
    if (text.trim().length < 50) return;
    analyze.mutate({ text, hint: hint.trim() || undefined });
  };

  return (
    <ModuleShell icon="◧" label="DOCS" sub="Análise · Resumo · Riscos · Ações" color={PRIMARY}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {(["paste", "drive"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="hud-label"
              style={{
                padding: "8px 14px",
                fontSize: 10,
                background: tab === t ? `${PRIMARY}20` : "transparent",
                border: `1px solid ${tab === t ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                color: tab === t ? PRIMARY : "rgba(255,255,255,0.4)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {t === "paste" ? "◧ COLAR TEXTO" : "◉ DRIVE"}
            </button>
          ))}
        </div>

        {tab === "paste" && (
          <div
            style={{
              padding: 16,
              marginBottom: 20,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${PRIMARY}30`,
              borderRadius: 10,
            }}
          >
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder='Contexto opcional (ex: "contrato SaaS B2B")'
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
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cola o documento aqui — mínimo 50 caracteres. Limite ~25k chars."
              rows={10}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 12,
                fontFamily: "'Share Tech Mono', monospace",
                outline: "none",
                resize: "vertical",
                marginBottom: 10,
              }}
            />
            <button
              onClick={handleAnalyzePaste}
              disabled={loading || text.trim().length < 50}
              className="hud-label"
              style={{
                padding: "8px 14px",
                fontSize: 10,
                background: `${PRIMARY}25`,
                border: `1px solid ${PRIMARY}`,
                color: PRIMARY,
                borderRadius: 6,
                cursor: text.trim().length < 50 ? "not-allowed" : "pointer",
                opacity: text.trim().length < 50 ? 0.4 : 1,
              }}
            >
              {loading ? "ANALISANDO…" : "▶ ANALISAR"}
            </button>
            <span
              style={{
                marginLeft: 10,
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              {text.length} chars
            </span>
          </div>
        )}

        {tab === "drive" && (
          <div
            style={{
              padding: 16,
              marginBottom: 20,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${PRIMARY}30`,
              borderRadius: 10,
            }}
          >
            <input
              value={driveQuery}
              onChange={(e) => setDriveQuery(e.target.value)}
              placeholder="Buscar no Drive…"
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13,
                fontFamily: "'Rajdhani', sans-serif",
                outline: "none",
                marginBottom: 12,
              }}
            />
            {recent.isLoading && (
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
                ◌ carregando…
              </div>
            )}
            {recent.error && (
              <div style={{ fontSize: 11, color: "#EF4444" }}>
                ✗ {(recent.error as Error).message}. Conecta o Drive em /integrations.
              </div>
            )}
            {recent.data && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recent.data.length === 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    Nenhum arquivo. Tenta outro termo.
                  </div>
                )}
                {recent.data.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => analyzeDrive.mutate(f.id)}
                    disabled={loading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(124,58,237,0.2)",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>{f.name}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.3)",
                          fontFamily: "'Share Tech Mono', monospace",
                        }}
                      >
                        {f.mimeType.split(".").pop()} · {new Date(f.modifiedTime).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <span className="hud-label" style={{ fontSize: 9, color: PRIMARY }}>
                      ANALISAR →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 16,
              marginBottom: 20,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              color: "#EF4444",
              fontSize: 12,
            }}
          >
            ✗ {(error as Error).message}
          </div>
        )}

        {result && <DocAnalysisCard analysis={result} />}
      </div>
    </ModuleShell>
  );
}

function DocAnalysisCard({ analysis }: { analysis: DocAnalysis }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Block title={`RESUMO · ${analysis.category.toUpperCase()}`} color="#00D4FF">
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>
          {analysis.summary}
        </div>
      </Block>

      {analysis.risks.length > 0 && (
        <Block title={`RISCOS · ${analysis.risks.length}`} color="#EF4444">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {analysis.risks.map((r, i) => (
              <div key={i}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 8,
                      padding: "1px 6px",
                      border: `1px solid ${LEVEL_COLOR[r.level]}`,
                      color: LEVEL_COLOR[r.level],
                      borderRadius: 3,
                    }}
                  >
                    {r.level.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                    {r.topic}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {r.detail}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {analysis.actions.length > 0 && (
        <Block title={`AÇÕES SUGERIDAS · ${analysis.actions.length}`} color="#10B981">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {analysis.actions.map((a, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#10B981", marginBottom: 3 }}>
                  {i + 1}. {a.title}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {a.why}
                </div>
                {(a.owner || a.deadline) && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'Share Tech Mono', monospace",
                      marginTop: 3,
                    }}
                  >
                    {a.owner && `dono: ${a.owner}`}
                    {a.owner && a.deadline && " · "}
                    {a.deadline && `prazo: ${a.deadline}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {analysis.questions.length > 0 && (
        <Block title={`PERGUNTAS CRÍTICAS · ${analysis.questions.length}`} color="#F59E0B">
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {analysis.questions.map((q, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.7,
                  marginBottom: 6,
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.015)",
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
      }}
    >
      <div
        className="hud-label"
        style={{ fontSize: 10, color, marginBottom: 12, letterSpacing: "0.2em" }}
      >
        ▸ {title}
      </div>
      {children}
    </div>
  );
}
