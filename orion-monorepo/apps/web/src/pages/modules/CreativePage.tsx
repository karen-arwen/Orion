import { useState, type CSSProperties } from "react";
import type { ContentIdea } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useCreative } from "../../hooks/modules/useCreative.js";

const COLOR = "#EC4899";
const COLUMNS = [
  { id: "idea", label: "IDEIA" },
  { id: "draft", label: "RASCUNHO" },
  { id: "scheduled", label: "AGENDADO" },
  { id: "published", label: "PUBLICADO" },
] as const;

export function CreativePage(): JSX.Element {
  const { ideas, isLoading, error, create, generate, updateStatus, remove } = useCreative();
  const [niche, setNiche] = useState("dev");
  const [format, setFormat] = useState("Reels");
  const [theme, setTheme] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const createManual = (): void => {
    if (!title.trim() || !body.trim()) return;
    void create({ title, body, niche, format }).then(() => {
      setTitle("");
      setBody("");
    });
  };

  return (
    <ModuleShell icon="✦" label="CRIACAO" sub="Ideias · Nomes · Conteudo" color={COLOR}>
      <div style={layoutStyle}>
        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>GERADOR</div>
          <input value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="nicho: dev, geek, make..." style={inputStyle} />
          <select value={format} onChange={(event) => setFormat(event.target.value)} style={inputStyle}>
            <option>Reels</option>
            <option>Carrossel</option>
            <option>Stories</option>
            <option>Thread</option>
            <option>Post estatico</option>
          </select>
          <input value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="tema opcional" style={inputStyle} />
          <button className="hud-label" disabled={isLoading} onClick={() => void generate({ niche, format, theme: theme || undefined, count: 3 })} style={buttonStyle}>
            GERAR 3 IDEIAS
          </button>
          {error && <div style={errorStyle}>{error}</div>}
        </section>

        <section style={panelStyle}>
          <div className="hud-label" style={labelStyle}>IDEIA MANUAL</div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="titulo" style={inputStyle} />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="corpo, roteiro, gancho..." style={textareaStyle} />
          <button className="hud-label" disabled={isLoading} onClick={createManual} style={buttonStyle}>SALVAR IDEIA</button>
        </section>

        <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
          <div className="hud-label" style={labelStyle}>BANCO DE IDEIAS</div>
          <div style={kanbanStyle}>
            {COLUMNS.map((column) => (
              <div key={column.id} style={columnStyle}>
                <div className="hud-label" style={columnTitleStyle}>{column.label}</div>
                {ideas.filter((idea) => idea.status === column.id).map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onMove={(status) => updateStatus(idea.id, { status })}
                    onRemove={() => remove(idea.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ModuleShell>
  );
}

function IdeaCard({
  idea,
  onMove,
  onRemove,
}: {
  idea: ContentIdea;
  onMove: (status: "idea" | "draft" | "scheduled" | "published") => Promise<void>;
  onRemove: () => Promise<void>;
}): JSX.Element {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div>
          <div style={cardTitleStyle}>{idea.title}</div>
          <div style={mutedStyle}>{idea.niche} · {idea.format}</div>
        </div>
        <button onClick={() => void onRemove()} style={removeButtonStyle}>×</button>
      </div>
      <pre style={bodyStyle}>{idea.body}</pre>
      <div style={moveGridStyle}>
        {COLUMNS.map((column) => (
          <button
            key={column.id}
            className="hud-label"
            disabled={idea.status === column.id}
            onClick={() => void onMove(column.id)}
            style={miniButtonStyle}
          >
            {column.label.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}

const layoutStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18, alignItems: "start" };
const panelStyle: CSSProperties = { padding: 18, border: `1px solid ${COLOR}22`, borderRadius: 10, background: "rgba(10,15,26,0.76)", boxShadow: `0 0 36px ${COLOR}08`, overflow: "hidden" };
const labelStyle: CSSProperties = { color: COLOR, fontSize: 10, letterSpacing: "0.12em", marginBottom: 12 };
const inputStyle: CSSProperties = { width: "100%", padding: 10, marginBottom: 10, background: "rgba(255,255,255,0.035)", border: `1px solid ${COLOR}30`, borderRadius: 6, color: "#fff", fontSize: 13 };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 112, resize: "vertical" };
const buttonStyle: CSSProperties = { width: "100%", padding: 11, background: "rgba(236,72,153,0.14)", border: `1px solid ${COLOR}66`, color: COLOR, borderRadius: 6, cursor: "pointer", fontSize: 10 };
const errorStyle: CSSProperties = { color: "#EF4444", fontSize: 12, marginTop: 10 };
const kanbanStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 };
const columnStyle: CSSProperties = { minHeight: 420, maxHeight: 720, overflowY: "auto", padding: 10, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 };
const columnTitleStyle: CSSProperties = { color: "rgba(255,255,255,0.38)", fontSize: 9, marginBottom: 10 };
const cardStyle: CSSProperties = { padding: 12, marginBottom: 10, border: `1px solid ${COLOR}24`, borderRadius: 8, background: "rgba(3,5,9,0.62)" };
const cardHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10 };
const cardTitleStyle: CSSProperties = { color: "#fff", fontSize: 14, fontWeight: 600, lineHeight: 1.25 };
const mutedStyle: CSSProperties = { color: "rgba(255,255,255,0.36)", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" };
const bodyStyle: CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "rgba(255,255,255,0.66)", fontSize: 12, lineHeight: 1.45, fontFamily: "'Rajdhani', sans-serif", margin: "10px 0" };
const removeButtonStyle: CSSProperties = { width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.35)", cursor: "pointer" };
const moveGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 };
const miniButtonStyle: CSSProperties = { padding: 7, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLOR}20`, color: COLOR, borderRadius: 5, cursor: "pointer", fontSize: 8 };
