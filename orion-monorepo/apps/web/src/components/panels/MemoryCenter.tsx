import { useMemo, useState } from "react";
import type { MemoryRecord, MemoryType } from "@orion/types";
import { useCreateMemory, useDeleteMemory, useMemories, useUpdateMemory } from "../../hooks/useMemories.js";

const TYPES: Array<{ id: MemoryType | "all"; label: string; color: string }> = [
  { id: "all", label: "TODAS", color: "#00D4FF" },
  { id: "preference", label: "PREFERENCIAS", color: "#10B981" },
  { id: "feedback", label: "FEEDBACK", color: "#F59E0B" },
  { id: "fact", label: "FATOS", color: "#7C3AED" },
  { id: "project", label: "PROJETOS", color: "#EC4899" },
  { id: "relationship", label: "PESSOAS", color: "#38BDF8" },
  { id: "event", label: "EVENTOS", color: "#64748B" },
];

function typeColor(type: MemoryType): string {
  return TYPES.find((item) => item.id === type)?.color ?? "#00D4FF";
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

interface MemoryCenterProps {
  color: string;
  onSendToChat: (text: string) => void;
}

export function MemoryCenter({ color, onSendToChat }: MemoryCenterProps): JSX.Element {
  const [type, setType] = useState<MemoryType | "all">("all");
  const [query, setQuery] = useState("");
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<MemoryType>("preference");
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [editingText, setEditingText] = useState("");
  const filters = useMemo(
    () => ({
      type: type === "all" ? undefined : type,
      q: query.trim() || undefined,
      pinned: onlyPinned ? true : undefined,
      limit: 50,
    }),
    [onlyPinned, query, type],
  );
  const memories = useMemories(filters);
  const create = useCreateMemory();
  const update = useUpdateMemory();
  const remove = useDeleteMemory();
  const data = memories.data;

  const startEditing = (memory: MemoryRecord): void => {
    setEditing(memory);
    setEditingText(memory.content);
  };

  const saveEditing = async (): Promise<void> => {
    if (!editing || !editingText.trim()) return;
    await update.mutateAsync({ id: editing.id, input: { content: editingText.trim() } });
    setEditing(null);
    setEditingText("");
  };

  const addMemory = async (): Promise<void> => {
    if (!draft.trim()) return;
    await create.mutateAsync({ type: draftType, content: draft.trim(), importance: 0.72, pinned: draftType === "preference" });
    setDraft("");
  };

  return (
    <section className="dash-section" style={{ borderColor: `${color}24` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
        <div>
          <div className="hud-label" style={{ color, fontSize: 10 }}>
            MEMORY CENTER
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>
            Controle fino do que o Orion aprende, fixa e esquece.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: 10, textAlign: "right" }}>
          <MemoryStat label="TOTAL" value={data?.total ?? 0} color={color} />
          <MemoryStat label="FIXAS" value={data?.stats.pinned ?? 0} color="#F59E0B" />
          <MemoryStat label="PESO" value={`${Math.round((data?.stats.averageImportance ?? 0) * 100)}%`} color="#10B981" />
        </div>
      </div>

      <div className="memory-toolbar">
        <input
          className="orion-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar memoria"
        />
        <button
          type="button"
          onClick={() => setOnlyPinned((value) => !value)}
          className="orion-command"
          style={{
            color: onlyPinned ? "#F59E0B" : "rgba(255,255,255,0.42)",
            borderColor: onlyPinned ? "#F59E0B66" : "rgba(255,255,255,0.1)",
            background: onlyPinned ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.02)",
          }}
        >
          FIXADAS
        </button>
      </div>

      <div className="memory-type-strip">
        {TYPES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setType(item.id)}
            className="hud-label"
            style={{
              color: type === item.id ? item.color : "rgba(255,255,255,0.28)",
              borderColor: type === item.id ? `${item.color}66` : "rgba(255,255,255,0.08)",
              background: type === item.id ? `${item.color}14` : "rgba(255,255,255,0.015)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="memory-create-row">
        <select className="orion-input" value={draftType} onChange={(event) => setDraftType(event.target.value as MemoryType)}>
          {TYPES.filter((item): item is { id: MemoryType; label: string; color: string } => item.id !== "all").map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          className="orion-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nova regra/memoria manual"
        />
        <button
          type="button"
          onClick={() => void addMemory()}
          disabled={create.isPending || !draft.trim()}
          className="orion-command"
          style={{ color, borderColor: `${color}55`, background: `${color}14` }}
        >
          GRAVAR
        </button>
      </div>

      {memories.isLoading ? (
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, padding: "12px 0" }}>Carregando memoria...</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="memory-empty">
          <strong>Nenhuma memoria nesse filtro.</strong>
          <span>Adicione uma regra manual ou use o chat para o Orion aprender com feedback.</span>
          <button
            type="button"
            onClick={() => onSendToChat("Me faça perguntas para montar meu perfil operacional: preferências, estilo, limites e prioridades.")}
            className="orion-command"
            style={{ color, borderColor: `${color}55`, background: `${color}14` }}
          >
            CALIBRAR VIA CHAT
          </button>
        </div>
      ) : (
        <div className="memory-list">
          {data?.items.map((memory) => (
            <article key={memory.id} className="memory-row" style={{ borderColor: `${typeColor(memory.type)}24` }}>
              <div className="memory-row-head">
                <div>
                  <span className="hud-label" style={{ color: typeColor(memory.type), fontSize: 8 }}>
                    {memory.type}
                  </span>
                  <span>{shortDate(memory.updatedAt)}</span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => void update.mutateAsync({ id: memory.id, input: { pinned: !memory.pinned } })}
                    className="memory-icon-button"
                    title={memory.pinned ? "Desfixar memoria" : "Fixar memoria"}
                  >
                    {memory.pinned ? "FIXA" : "FIXAR"}
                  </button>
                  <button type="button" onClick={() => startEditing(memory)} className="memory-icon-button">
                    EDITAR
                  </button>
                  <button type="button" onClick={() => void remove.mutateAsync(memory.id)} className="memory-icon-button danger">
                    APAGAR
                  </button>
                </div>
              </div>
              {editing?.id === memory.id ? (
                <div className="memory-edit-box">
                  <textarea className="orion-input" value={editingText} onChange={(event) => setEditingText(event.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => void saveEditing()} className="orion-command" style={{ color: "#10B981", borderColor: "#10B98155", background: "rgba(16,185,129,0.12)" }}>
                      SALVAR
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="orion-command">
                      CANCELAR
                    </button>
                  </div>
                </div>
              ) : (
                <p>{memory.content}</p>
              )}
              <div className="memory-weight">
                <span>importancia {Math.round(memory.importance * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={memory.importance}
                  onChange={(event) =>
                    void update.mutateAsync({ id: memory.id, input: { importance: Number(event.target.value) } })
                  }
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MemoryStat(props: { label: string; value: string | number; color: string }): JSX.Element {
  return (
    <div>
      <div style={{ color: props.color, fontFamily: "'Share Tech Mono', monospace", fontSize: 16 }}>{props.value}</div>
      <div className="hud-label" style={{ color: "rgba(255,255,255,0.25)", fontSize: 8 }}>
        {props.label}
      </div>
    </div>
  );
}
