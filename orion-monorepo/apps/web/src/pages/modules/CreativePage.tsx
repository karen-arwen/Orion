import { useState } from "react";
import type { ContentIdea, IdeaStatus } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useCreateIdea,
  useDeleteIdea,
  useGenerateIdeas,
  useIdeas,
  useUpdateIdea,
} from "../../hooks/modules/useCreative.js";

const PRIMARY = "#EC4899";

const COLUMNS: Array<{ id: IdeaStatus; label: string; color: string }> = [
  { id: "ideia", label: "IDEIA", color: "#64748B" },
  { id: "rascunho", label: "RASCUNHO", color: "#00D4FF" },
  { id: "agendado", label: "AGENDADO", color: "#F59E0B" },
  { id: "publicado", label: "PUBLICADO", color: "#10B981" },
];

const FORMATS = ["reels", "carrossel", "estatico", "stories", "thread", "blog", "video"];

export function CreativePage(): JSX.Element {
  const { data: ideas, isLoading } = useIdeas();
  const create = useCreateIdea();
  const update = useUpdateIdea();
  const remove = useDeleteIdea();
  const generate = useGenerateIdeas();

  const [niche, setNiche] = useState("geral");
  const [audience, setAudience] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newFormat, setNewFormat] = useState("reels");

  const handleGenerate = (): void => {
    generate.mutate({ niche, audience: audience.trim() || undefined, save: true });
  };

  const handleCreate = (): void => {
    if (!newTitle.trim()) return;
    create.mutate(
      { title: newTitle.trim(), format: newFormat, niche, status: "ideia" },
      { onSuccess: () => setNewTitle("") },
    );
  };

  const columnItems = (status: IdeaStatus): ContentIdea[] =>
    (ideas ?? []).filter((i) => i.status === status);

  return (
    <ModuleShell icon="✦" label="CRIAÇÃO" sub="Ideias · Estratégia · Conteúdo" color={PRIMARY}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Gerador IA */}
        <div
          style={{
            padding: 16,
            marginBottom: 18,
            background: "linear-gradient(135deg, rgba(236,72,153,0.1), transparent)",
            border: `1px solid ${PRIMARY}30`,
            borderRadius: 10,
          }}
        >
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, marginBottom: 10 }}>
            ✦ GERADOR IA — 5 IDEIAS DE UMA VEZ
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              style={{
                padding: "8px 10px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${PRIMARY}40`,
                borderRadius: 6,
                color: "#fff",
                fontSize: 12,
                fontFamily: "'Rajdhani', sans-serif",
                outline: "none",
              }}
            >
              {["geral", "geek", "dev", "lifestyle", "make", "anime", "games"].map((n) => (
                <option key={n} value={n} style={{ background: "#0A0F1A" }}>{n}</option>
              ))}
            </select>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder='Audiência (ex: "iniciantes em React")'
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 12,
                fontFamily: "'Rajdhani', sans-serif",
                outline: "none",
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
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
              {generate.isPending ? "GERANDO…" : "+ GERAR 5 IDEIAS"}
            </button>
          </div>
          {generate.data && generate.data.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#10B981" }}>
              ✓ {generate.data.length} ideias geradas e salvas como "IDEIA"
            </div>
          )}
        </div>

        {/* Criar manual */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 8,
            flexWrap: "wrap",
          }}
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Criar ideia manual…"
            style={{
              flex: 1,
              minWidth: 200,
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
              outline: "none",
              fontFamily: "'Rajdhani', sans-serif",
            }}
          />
          <select
            value={newFormat}
            onChange={(e) => setNewFormat(e.target.value)}
            style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontFamily: "'Share Tech Mono', monospace",
              outline: "none",
            }}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f} style={{ background: "#0A0F1A" }}>{f}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.7)",
              borderRadius: 6,
              cursor: newTitle.trim() ? "pointer" : "not-allowed",
              opacity: newTitle.trim() ? 1 : 0.4,
            }}
          >
            + CRIAR
          </button>
        </div>

        {isLoading && (
          <div
            className="hud-label"
            style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}
          >
            ◌ carregando…
          </div>
        )}

        {/* Kanban */}
        {ideas && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {COLUMNS.map((col) => (
              <div
                key={col.id}
                style={{
                  padding: 12,
                  background: "rgba(255,255,255,0.015)",
                  border: `1px solid ${col.color}25`,
                  borderRadius: 10,
                  minHeight: 300,
                }}
              >
                <div
                  className="hud-label"
                  style={{
                    fontSize: 10,
                    color: col.color,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${col.color}22`,
                  }}
                >
                  {col.label} · {columnItems(col.id).length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {columnItems(col.id).map((it) => (
                    <IdeaCard
                      key={it.id}
                      idea={it}
                      color={col.color}
                      onMove={(status) => update.mutate({ id: it.id, patch: { status } })}
                      onDelete={() => remove.mutate(it.id)}
                    />
                  ))}
                  {columnItems(col.id).length === 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.15)",
                        fontFamily: "'Share Tech Mono', monospace",
                        textAlign: "center",
                        padding: 16,
                      }}
                    >
                      —
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}

interface IdeaCardProps {
  idea: ContentIdea;
  color: string;
  onMove: (status: IdeaStatus) => void;
  onDelete: () => void;
}

function IdeaCard({ idea, color, onMove, onDelete }: IdeaCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        padding: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}22`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <div
        onClick={() => setOpen((p) => !p)}
        style={{ color: "rgba(255,255,255,0.9)", marginBottom: 6, lineHeight: 1.4, cursor: "pointer" }}
      >
        {idea.title}
      </div>
      <div
        className="hud-label"
        style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}
      >
        {idea.format} · {idea.niche}
      </div>
      {open && idea.body && (
        <div
          style={{
            padding: 8,
            marginBottom: 6,
            background: "rgba(0,0,0,0.2)",
            borderRadius: 4,
            fontSize: 11,
            color: "rgba(255,255,255,0.65)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {idea.body}
        </div>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(["ideia", "rascunho", "agendado", "publicado"] as IdeaStatus[])
          .filter((s) => s !== idea.status)
          .map((s) => (
            <button
              key={s}
              onClick={() => onMove(s)}
              className="hud-label"
              style={{
                padding: "2px 6px",
                fontSize: 8,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              → {s.slice(0, 4).toUpperCase()}
            </button>
          ))}
        <button
          onClick={onDelete}
          style={{
            marginLeft: "auto",
            padding: "2px 6px",
            fontSize: 8,
            background: "transparent",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "rgba(239,68,68,0.7)",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
