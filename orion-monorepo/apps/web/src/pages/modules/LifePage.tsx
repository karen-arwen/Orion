import { useState } from "react";
import type { Task, TaskStatus } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useSuggestNext,
} from "../../hooks/modules/useLife.js";

const COLUMNS: Array<{ id: TaskStatus; label: string; color: string }> = [
  { id: "todo", label: "TODO", color: "#64748B" },
  { id: "doing", label: "DOING", color: "#00D4FF" },
  { id: "done", label: "DONE", color: "#10B981" },
];

export function LifePage(): JSX.Element {
  const { data: tasks, isLoading, error } = useTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const suggest = useSuggestNext();

  const [newTitle, setNewTitle] = useState("");
  const [newEnergy, setNewEnergy] = useState<1 | 2 | 3>(2);
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [currentEnergy, setCurrentEnergy] = useState<1 | 2 | 3>(2);

  const handleCreate = (): void => {
    if (!newTitle.trim()) return;
    create.mutate(
      { title: newTitle.trim(), energy: newEnergy, priority: newPriority },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewEnergy(2);
          setNewPriority(2);
        },
      },
    );
  };

  const columnTasks = (status: TaskStatus): Task[] =>
    (tasks ?? []).filter((t) => t.status === status);

  return (
    <ModuleShell icon="◎" label="LIFE OS" sub="Tarefas · Energia · Planner" color="#7C3AED">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Suggest next */}
        <div
          style={{
            padding: 16,
            marginBottom: 20,
            background: "linear-gradient(135deg, rgba(124,58,237,0.08), transparent)",
            border: "1px solid rgba(124,58,237,0.25)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="hud-label" style={{ fontSize: 10, color: "#7C3AED" }}>
              ENERGIA AGORA:
            </span>
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => setCurrentEnergy(n)}
                className="hud-label"
                style={{
                  padding: "4px 10px",
                  fontSize: 9,
                  background: currentEnergy === n ? "rgba(124,58,237,0.25)" : "transparent",
                  border: "1px solid rgba(124,58,237,0.4)",
                  color: currentEnergy === n ? "#7C3AED" : "rgba(255,255,255,0.4)",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                {n === 1 ? "BAIXA" : n === 2 ? "NORMAL" : "ALTA"}
              </button>
            ))}
            <button
              onClick={() => suggest.mutate(currentEnergy)}
              disabled={suggest.isPending}
              className="hud-label"
              style={{
                marginLeft: "auto",
                padding: "6px 12px",
                fontSize: 10,
                background: "rgba(124,58,237,0.2)",
                border: "1px solid #7C3AED",
                color: "#7C3AED",
                borderRadius: 6,
                cursor: suggest.isPending ? "wait" : "pointer",
              }}
            >
              {suggest.isPending ? "PENSANDO…" : "◉ SUGERIR PRÓXIMA"}
            </button>
          </div>
          {suggest.data && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "rgba(255,255,255,0.8)",
                fontFamily: "'Share Tech Mono', monospace",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {suggest.data.suggestion}
            </div>
          )}
        </div>

        {/* New task */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
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
            placeholder="Nova tarefa…"
            style={{
              flex: 1,
              minWidth: 200,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
              outline: "none",
              fontFamily: "'Rajdhani', sans-serif",
            }}
          />
          <SelectGroup label="ENERGIA" value={newEnergy} onChange={setNewEnergy} />
          <SelectGroup label="PRIORIDADE" value={newPriority} onChange={setNewPriority} />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim() || create.isPending}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: "rgba(124,58,237,0.2)",
              border: "1px solid #7C3AED",
              color: "#7C3AED",
              borderRadius: 6,
              cursor: newTitle.trim() ? "pointer" : "not-allowed",
              opacity: newTitle.trim() ? 1 : 0.4,
            }}
          >
            + CRIAR
          </button>
        </div>

        {isLoading && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
            ◌ carregando tarefas…
          </div>
        )}
        {error && (
          <div
            style={{
              padding: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              color: "#EF4444",
              fontSize: 12,
            }}
          >
            ✗ Falha: {(error as Error).message}
          </div>
        )}

        {tasks && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
                  {col.label} · {columnTasks(col.id).length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {columnTasks(col.id).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      color={col.color}
                      onMove={(status) => update.mutate({ id: t.id, status })}
                      onDelete={() => remove.mutate(t.id)}
                    />
                  ))}
                  {columnTasks(col.id).length === 0 && (
                    <div
                      style={{
                        fontSize: 11,
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

function SelectGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 1 | 2 | 3;
  onChange: (v: 1 | 2 | 3) => void;
}): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
      {([1, 2, 3] as const).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            width: 24,
            height: 24,
            fontSize: 10,
            background: value === n ? "rgba(124,58,237,0.25)" : "transparent",
            border: `1px solid ${value === n ? "#7C3AED" : "rgba(255,255,255,0.1)"}`,
            color: value === n ? "#7C3AED" : "rgba(255,255,255,0.4)",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  color: string;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
}

function TaskCard({ task, color, onMove, onDelete }: TaskCardProps): JSX.Element {
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
      <div style={{ color: "rgba(255,255,255,0.9)", marginBottom: 6, lineHeight: 1.4 }}>
        {task.title}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.3)",
          marginBottom: 6,
        }}
      >
        <span>E:{task.energy}</span>
        <span>·</span>
        <span>P:{task.priority}</span>
        {task.estMinutes && (
          <>
            <span>·</span>
            <span>~{task.estMinutes}m</span>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {(["todo", "doing", "done"] as const)
          .filter((s) => s !== task.status)
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
              → {s.toUpperCase()}
            </button>
          ))}
        <button
          onClick={onDelete}
          className="hud-label"
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
