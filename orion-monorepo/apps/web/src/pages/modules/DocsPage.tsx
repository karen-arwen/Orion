import { useRef, useState } from "react";
import type { DocAnalysisResult, DocAnalysisSection, UploadedDocumentInput } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useDocs } from "../../hooks/modules/useDocs.js";

const COLOR = "#00D4FF";

export function DocsPage(): JSX.Element {
  const { files, analyses, active, isLoading, error, fetchDrive, analyzeDrive, analyzeUpload } = useDocs();
  const [query, setQuery] = useState("");
  const [instruction, setInstruction] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File): Promise<void> => {
    const base64 = await fileToBase64(file);
    const payload: UploadedDocumentInput = {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64,
    };
    await analyzeUpload(payload, instruction || undefined);
  };

  return (
    <ModuleShell icon="◧" label="DOCUMENTOS" sub="Analise · Contratos · Drive" color={COLOR}>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, maxWidth: 1180, margin: "0 auto" }}>
        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>DRIVE / UPLOAD</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="buscar no Drive"
              style={inputStyle}
            />
            <button onClick={() => void fetchDrive(query || undefined)} style={buttonStyle}>
              BUSCAR
            </button>
          </div>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="pedido opcional: resume, procura riscos, prepara resposta..."
            style={{ ...inputStyle, minHeight: 72, resize: "vertical", marginBottom: 10 }}
          />
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = "";
            }}
          />
          <button onClick={() => inputRef.current?.click()} style={{ ...buttonStyle, width: "100%", marginBottom: 14 }}>
            ANALISAR UPLOAD
          </button>

          {error && <div style={errorStyle}>{error}</div>}
          {isLoading && <div className="hud-label" style={{ color: COLOR, marginBottom: 12 }}>PROCESSANDO...</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => void analyzeDrive(file, instruction || undefined)}
                style={fileButtonStyle}
              >
                <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>{file.name}</span>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 10 }}>{shortMime(file.mimeType)}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
            <div>
              <div className="hud-label" style={labelStyle}>ANALISE EXECUTIVA</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                {active ? active.fileName : "Nenhum documento analisado ainda."}
              </div>
            </div>
            <div className="hud-label" style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>
              HISTORICO {analyses.length}
            </div>
          </div>

          {active ? <DocAnalysisCard summary={active.summary} /> : <EmptyState />}
        </section>
      </div>
    </ModuleShell>
  );
}

function DocAnalysisCard({ summary }: { summary: DocAnalysisResult }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Collapsible title="RESUMO" defaultOpen>
        <p style={textStyle}>{summary.executiveSummary}</p>
      </Collapsible>
      <Collapsible title="RISCOS">
        <SectionList items={summary.risks} />
      </Collapsible>
      <Collapsible title="ACOES">
        <SectionList items={summary.actions} />
      </Collapsible>
      <Collapsible title="PERGUNTAS">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {summary.criticalQuestions.map((question) => (
            <li key={question} style={textStyle}>{question}</li>
          ))}
        </ul>
      </Collapsible>
      <Collapsible title="RASCUNHO">
        <p style={textStyle}>{summary.draftResponse}</p>
      </Collapsible>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${COLOR}20`, borderRadius: 8, background: "rgba(255,255,255,0.018)" }}>
      <button onClick={() => setOpen((value) => !value)} className="hud-label" style={collapseButtonStyle}>
        {title}
        <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "12px 14px" }}>{children}</div>}
    </div>
  );
}

function SectionList({ items }: { items: DocAnalysisSection[] }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <div key={`${item.title}-${item.body}`}>
          <div style={{ color: COLOR, fontWeight: 700, fontSize: 13 }}>{item.title}</div>
          <div style={textStyle}>{item.body}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyState(): JSX.Element {
  return <div className="hud-label" style={{ color: "rgba(255,255,255,0.24)", padding: 40, textAlign: "center" }}>SELECIONE UM ARQUIVO DO DRIVE OU ENVIE PDF/DOCX/TXT</div>;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function shortMime(mime: string): string {
  if (mime.includes("document")) return "Google Doc / DOCX";
  if (mime.includes("spreadsheet")) return "Planilha";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("text")) return "Texto";
  return mime;
}

const panelStyle: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${COLOR}18`,
  borderRadius: 8,
  background: "rgba(10,15,26,0.72)",
  minHeight: 520,
};

const labelStyle: React.CSSProperties = { fontSize: 10, color: COLOR, marginBottom: 10, letterSpacing: "0.16em" };
const textStyle: React.CSSProperties = { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.6, margin: 0 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.035)",
  border: `1px solid ${COLOR}24`,
  borderRadius: 6,
  color: "rgba(255,255,255,0.86)",
  padding: "9px 10px",
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: 11,
};
const buttonStyle: React.CSSProperties = {
  background: "rgba(0,212,255,0.12)",
  border: `1px solid ${COLOR}45`,
  color: COLOR,
  borderRadius: 6,
  padding: "9px 12px",
  cursor: "pointer",
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: 10,
};
const fileButtonStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  textAlign: "left",
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 7,
  padding: 10,
  cursor: "pointer",
};
const collapseButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  background: "transparent",
  border: "none",
  color: COLOR,
  padding: "10px 12px",
  cursor: "pointer",
};
const errorStyle: React.CSSProperties = {
  color: "#EF4444",
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.25)",
  borderRadius: 6,
  padding: 10,
  fontSize: 12,
  marginBottom: 10,
};
