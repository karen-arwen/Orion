import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Task, TaskStatus, RecurrenceRule } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useTasks,
  useAllTasks,
  useTasksByDate,
  useOverdueTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteRecurring,
  useSuggestNext,
} from "../../hooks/modules/useLife.js";

const PURPLE = "#7C3AED";
const CYAN = "#00D4FF";
const GREEN = "#10B981";
const RED = "#EF4444";
const YELLOW = "#F59E0B";

const COLUMNS: Array<{ id: TaskStatus; label: string; color: string; icon: string }> = [
  { id: "todo",  label: "TODO",   color: "#64748B", icon: "◯" },
  { id: "doing", label: "DOING",  color: CYAN,       icon: "▷" },
  { id: "done",  label: "DONE",   color: GREEN,      icon: "✓" },
];

const RECURRENCE_OPTS: Array<{ v: RecurrenceRule; label: string }> = [
  { v: "daily",    label: "Diário"   },
  { v: "weekdays", label: "Seg-Sex"  },
  { v: "weekly",   label: "Semanal"  },
  { v: "monthly",  label: "Mensal"   },
];

type LifeTab = "kanban" | "today" | "bydate" | "overdue";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isOverdue(t: Task): boolean {
  if (!t.dueAt) return false;
  if (t.status === "done" || t.status === "archived") return false;
  return new Date(t.dueAt) < new Date();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function LifePage(): JSX.Element {
  const tasks     = useTasks();
  const allTasks  = useAllTasks();
  const overdue   = useOverdueTasks();
  const create    = useCreateTask();
  const update    = useUpdateTask();
  const remove    = useDeleteTask();
  const completeR = useCompleteRecurring();
  const suggest   = useSuggestNext();

  const [tab, setTab]                 = useState<LifeTab>("kanban");
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const dateTasks = useTasksByDate(selectedDate);

  // Create form state
  const [newTitle, setNewTitle]       = useState("");
  const [newEnergy, setNewEnergy]     = useState<1|2|3>(2);
  const [newPriority, setNewPriority] = useState<1|2|3>(2);
  const [newDueAt, setNewDueAt]       = useState("");
  const [newEstMin, setNewEstMin]     = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRule, setNewRule]         = useState<RecurrenceRule>("daily");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentEnergy, setCurrentEnergy] = useState<1|2|3>(2);

  // UI state
  const [celebrateId, setCelebrateId]   = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subTitle, setSubTitle]         = useState("");

  const taskList = tasks.data ?? [];
  const allList  = allTasks.data ?? [];
  const overdueList = overdue.data ?? [];

  const todoCount   = taskList.filter(t => t.status === "todo").length;
  const doingCount  = taskList.filter(t => t.status === "doing").length;
  const doneCount   = allList.filter(t => t.status === "done").length;
  const totalActive = taskList.length;
  const pct = totalActive > 0 ? Math.round((doneCount / (totalActive + doneCount)) * 100) : 0;

  const handleCreate = (): void => {
    if (!newTitle.trim()) return;
    create.mutate({
      title: newTitle.trim(),
      energy: newEnergy,
      priority: newPriority,
      dueAt: newDueAt ? new Date(newDueAt).toISOString() : undefined,
      estMinutes: newEstMin ? parseInt(newEstMin, 10) : undefined,
      isRecurring: newRecurring,
      recurrenceRule: newRecurring ? newRule : undefined,
    }, {
      onSuccess: () => {
        setNewTitle(""); setNewDueAt(""); setNewEstMin("");
        setNewRecurring(false); setShowAdvanced(false);
      },
    });
  };

  const handleAddSub = (parentId: string): void => {
    if (!subTitle.trim()) return;
    create.mutate({ title: subTitle.trim(), parentId, energy: 2, priority: 2 }, {
      onSuccess: () => { setSubTitle(""); setAddingSubFor(null); },
    });
  };

  const handleMove = (id: string, status: TaskStatus, isRec: boolean): void => {
    if (status === "done" && isRec) {
      completeR.mutate(id);
      setCelebrateId(id); setTimeout(() => setCelebrateId(null), 2000);
    } else {
      if (status === "done") { setCelebrateId(id); setTimeout(() => setCelebrateId(null), 2000); }
      update.mutate({ id, status });
    }
  };

  const columnTasks = (status: TaskStatus): Task[] =>
    taskList.filter(t => t.status === status);

  // Group by-date tasks into buckets for ±7 days
  const weekDates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      arr.push(toDateStr(d));
    }
    return arr;
  }, []);

  return (
    <ModuleShell icon="◎" label="LIFE OS" sub="Tarefas · Sub-tarefas · Recorrência · Datas" color={PURPLE}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 16 }}>
          <Stat label="TODO"      value={`${todoCount}`}        color="#64748B" />
          <Stat label="FAZENDO"   value={`${doingCount}`}       color={CYAN} />
          <Stat label="FEITO"     value={`${doneCount}`}        color={GREEN} />
          <Stat label="ATRASADAS" value={`${overdueList.length}`} color={overdueList.length > 0 ? RED : GREEN} onClick={() => setTab("overdue")} />
          <Stat label="PROGRESSO" value={`${pct}%`}             color={pct >= 80 ? GREEN : PURPLE} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${PURPLE}20`, paddingBottom: 2 }}>
          {([
            ["kanban",  "◫ KANBAN"],
            ["today",   "◷ HOJE"],
            ["bydate",  "📅 POR DATA"],
            ["overdue", `⚠ ATRASADAS${overdueList.length > 0 ? ` (${overdueList.length})` : ""}`],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="hud-label"
              style={{ padding: "8px 14px", fontSize: 9, background: tab === id ? `${PURPLE}18` : "transparent", border: "none", borderBottom: tab === id ? `2px solid ${PURPLE}` : "2px solid transparent", color: tab === id ? PURPLE : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Suggest next */}
        <div style={{ padding: 14, marginBottom: 16, background: `linear-gradient(135deg, ${PURPLE}08, transparent)`, border: `1px solid ${PURPLE}25`, borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>ENERGIA AGORA:</span>
            {([1,2,3] as const).map(n => (
              <button key={n} onClick={() => setCurrentEnergy(n)} className="hud-label"
                style={{ padding: "4px 10px", fontSize: 9, background: currentEnergy === n ? `${PURPLE}25` : "transparent", border: `1px solid ${currentEnergy === n ? PURPLE : "rgba(255,255,255,0.15)"}`, color: currentEnergy === n ? PURPLE : "rgba(255,255,255,0.4)", borderRadius: 4, cursor: "pointer" }}>
                {n === 1 ? "BAIXA" : n === 2 ? "NORMAL" : "ALTA"}
              </button>
            ))}
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => suggest.mutate(currentEnergy)} disabled={suggest.isPending}
              className="hud-label"
              style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 9, background: `${PURPLE}20`, border: `1px solid ${PURPLE}`, color: PURPLE, borderRadius: 5, cursor: "pointer" }}>
              {suggest.isPending ? "◌ PENSANDO..." : "◉ SUGERIR PRÓXIMA"}
            </motion.button>
          </div>
          <AnimatePresence>
            {suggest.data && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {suggest.data.suggestion}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Create form */}
        <div style={{ padding: 14, marginBottom: 18, background: "rgba(255,255,255,0.02)", border: `1px solid ${PURPLE}18`, borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: showAdvanced ? 12 : 0 }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !showAdvanced && handleCreate()}
              placeholder="Nova tarefa…"
              className="orion-input" style={{ flex: 1, minWidth: 200 }} />
            <EnergySelect label="E" value={newEnergy} onChange={setNewEnergy} color={PURPLE} />
            <PrioritySelect label="P" value={newPriority} onChange={setNewPriority} color={PURPLE} />
            <button onClick={() => setShowAdvanced(p => !p)} className="hud-label"
              style={{ padding: "7px 10px", fontSize: 9, background: showAdvanced ? `${YELLOW}15` : "transparent", border: `1px solid ${showAdvanced ? YELLOW : "rgba(255,255,255,0.1)"}`, color: showAdvanced ? YELLOW : "rgba(255,255,255,0.4)", borderRadius: 5, cursor: "pointer" }}>
              ⚙ MAIS
            </button>
            <motion.button whileHover={{ scale: 1.02 }} onClick={handleCreate} disabled={!newTitle.trim() || create.isPending}
              className="hud-label"
              style={{ padding: "7px 14px", fontSize: 10, background: `${PURPLE}20`, border: `1px solid ${PURPLE}`, color: PURPLE, borderRadius: 5, cursor: newTitle.trim() ? "pointer" : "not-allowed", opacity: newTitle.trim() ? 1 : 0.4 }}>
              {create.isPending ? "◌" : "+ CRIAR"}
            </motion.button>
          </div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 12, borderTop: `1px solid ${PURPLE}15` }}>
                  <div>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>PRAZO (DUE DATE)</div>
                    <input type="date" value={newDueAt} onChange={e => setNewDueAt(e.target.value)}
                      className="orion-input" style={{ colorScheme: "dark" }} />
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>EST. MINUTOS</div>
                    <input type="number" value={newEstMin} onChange={e => setNewEstMin(e.target.value)}
                      placeholder="ex: 30" className="orion-input" />
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>RECORRÊNCIA</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setNewRecurring(p => !p)}
                        style={{ padding: "5px 10px", fontSize: 10, background: newRecurring ? `${GREEN}15` : "transparent", border: `1px solid ${newRecurring ? GREEN : "rgba(255,255,255,0.1)"}`, color: newRecurring ? GREEN : "rgba(255,255,255,0.4)", borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                        {newRecurring ? "✓ ATIVO" : "◯ OFF"}
                      </button>
                      {newRecurring && (
                        <select value={newRule} onChange={e => setNewRule(e.target.value as RecurrenceRule)}
                          style={{ padding: "5px 8px", background: "rgba(255,255,255,0.05)", border: `1px solid ${GREEN}40`, color: GREEN, borderRadius: 4, fontSize: 11, fontFamily: "'Share Tech Mono', monospace", cursor: "pointer" }}>
                          {RECURRENCE_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} onClick={handleCreate} disabled={!newTitle.trim() || create.isPending}
                  className="hud-label"
                  style={{ marginTop: 12, padding: "8px 18px", fontSize: 10, background: `${PURPLE}20`, border: `1px solid ${PURPLE}`, color: PURPLE, borderRadius: 5, cursor: newTitle.trim() ? "pointer" : "not-allowed", opacity: newTitle.trim() ? 1 : 0.4 }}>
                  {create.isPending ? "◌ CRIANDO..." : "+ CRIAR TAREFA"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Celebration */}
        <AnimatePresence>
          {celebrateId && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "12px 24px", background: `linear-gradient(135deg, ${GREEN}CC, ${CYAN}AA)`, borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "'Share Tech Mono', monospace", boxShadow: `0 4px 24px ${GREEN}55`, letterSpacing: "0.1em" }}>
              🎉 TAREFA CONCLUÍDA!
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── KANBAN ── */}
        {tab === "kanban" && (
          <>
            {tasks.isLoading && <LoadingMsg />}
            {tasks.data && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {COLUMNS.map(col => (
                  <div key={col.id} style={{ padding: 12, background: "rgba(255,255,255,0.015)", border: `1px solid ${col.color}22`, borderRadius: 10, minHeight: 280 }}>
                    <div className="hud-label" style={{ fontSize: 10, color: col.color, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${col.color}20`, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{col.icon}</span>{col.label} · {columnTasks(col.id).length}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {columnTasks(col.id).map(t => (
                        <TaskCard key={t.id} task={t} color={col.color}
                          celebrating={celebrateId === t.id}
                          expanded={expandedId === t.id}
                          addingSubHere={addingSubFor === t.id}
                          subTitle={subTitle}
                          onToggleExpand={() => setExpandedId(expandedId === t.id ? null : t.id)}
                          onMove={status => handleMove(t.id, status, t.isRecurring)}
                          onDelete={() => remove.mutate(t.id)}
                          onAddSub={() => setAddingSubFor(addingSubFor === t.id ? null : t.id)}
                          onSubTitleChange={setSubTitle}
                          onSubCreate={() => handleAddSub(t.id)}
                          onSubMove={(sub, status) => handleMove(sub.id, status, false)}
                          onSubDelete={sub => remove.mutate(sub.id)}
                        />
                      ))}
                      {columnTasks(col.id).length === 0 && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.12)", fontFamily: "'Share Tech Mono', monospace", textAlign: "center", padding: 20 }}>—</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── HOJE ── */}
        {tab === "today" && (
          <DateTaskList
            tasks={dateTasks.data ?? []}
            loading={dateTasks.isLoading}
            dateLabel="HOJE"
            onMove={(t, s) => handleMove(t.id, s, t.isRecurring)}
            onDelete={t => remove.mutate(t.id)}
          />
        )}

        {/* ── POR DATA ── */}
        {tab === "bydate" && (
          <div>
            <div style={{ display: "flex", gap: 5, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 8, marginBottom: 14, scrollbarWidth: "none" }}>
              {weekDates.map(d => {
                const isToday = d === toDateStr(new Date());
                const isSel   = d === selectedDate;
                const wd = new Date(d).toLocaleDateString("pt-BR", { weekday: "short" });
                const day = new Date(d).getDate();
                return (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    style={{ minWidth: 52, padding: "8px 6px", background: isSel ? `${PURPLE}25` : isToday ? `${CYAN}0A` : "rgba(255,255,255,0.02)", border: `1px solid ${isSel ? PURPLE : isToday ? `${CYAN}40` : "rgba(255,255,255,0.07)"}`, borderRadius: 8, cursor: "pointer", textAlign: "center", flexShrink: 0 }}>
                    <div className="hud-label" style={{ fontSize: 8, color: isSel ? PURPLE : "rgba(255,255,255,0.3)" }}>{wd.toUpperCase()}</div>
                    <div style={{ fontSize: 15, fontFamily: "'Share Tech Mono', monospace", color: isSel ? PURPLE : isToday ? CYAN : "rgba(255,255,255,0.65)", marginTop: 2 }}>{day}</div>
                  </button>
                );
              })}
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", colorScheme: "dark", minWidth: 120 }} />
            </div>
            <DateTaskList
              tasks={dateTasks.data ?? []}
              loading={dateTasks.isLoading}
              dateLabel={new Date(selectedDate).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
              onMove={(t, s) => handleMove(t.id, s, t.isRecurring)}
              onDelete={t => remove.mutate(t.id)}
            />
          </div>
        )}

        {/* ── ATRASADAS ── */}
        {tab === "overdue" && (
          <div>
            {overdue.isLoading && <LoadingMsg />}
            {!overdue.isLoading && overdueList.length === 0 && (
              <EmptyState icon="✓" title="Tudo em dia!" sub="Nenhuma tarefa atrasada. Ótimo trabalho." color={GREEN} />
            )}
            {overdueList.length > 0 && (
              <>
                <div style={{ padding: "10px 14px", marginBottom: 14, background: `${RED}08`, border: `1px solid ${RED}25`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: RED, fontSize: 16 }}>⚠</span>
                  <span style={{ fontSize: 12, color: `${RED}cc`, fontFamily: "'Share Tech Mono', monospace" }}>{overdueList.length} tarefa{overdueList.length > 1 ? "s" : ""} com prazo vencido</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {overdueList.map(t => (
                    <motion.div key={t.id} layout style={{ padding: 14, background: `${RED}06`, border: `1px solid ${RED}25`, borderLeft: `3px solid ${RED}`, borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>{t.title}</div>
                          {t.dueAt && <div style={{ fontSize: 10, color: RED, fontFamily: "'Share Tech Mono', monospace" }}>⚠ VENCEU EM {fmtDate(t.dueAt)}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => handleMove(t.id, "doing", t.isRecurring)}
                            style={{ padding: "4px 8px", fontSize: 9, background: `${CYAN}12`, border: `1px solid ${CYAN}33`, color: CYAN, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>→ DOING</button>
                          <button onClick={() => handleMove(t.id, "done", t.isRecurring)}
                            style={{ padding: "4px 8px", fontSize: 9, background: `${GREEN}12`, border: `1px solid ${GREEN}33`, color: GREEN, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>✓ DONE</button>
                          <button onClick={() => remove.mutate(t.id)}
                            style={{ padding: "4px 8px", fontSize: 9, background: "transparent", border: `1px solid ${RED}33`, color: `${RED}aa`, borderRadius: 4, cursor: "pointer" }}>×</button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <ModuleChat
        module="life"
        label="LIFE OS"
        color={PURPLE}
        welcome="Posso organizar suas tarefas, criar recorrências, sugerir o que fazer agora e planejar sua semana. O que precisa?"
        suggestions={["O que fazer agora?", "Criar tarefa recorrente", "Ver o que vence hoje", "Organizar prioridades"]}
      />
    </ModuleShell>
  );
}

/* ─────────────────────────── TaskCard ─────────────────────────── */

function TaskCard({
  task, color, celebrating, expanded, addingSubHere, subTitle,
  onToggleExpand, onMove, onDelete, onAddSub, onSubTitleChange, onSubCreate,
  onSubMove, onSubDelete,
}: {
  task: Task; color: string; celebrating: boolean; expanded: boolean;
  addingSubHere: boolean; subTitle: string;
  onToggleExpand: () => void;
  onMove: (s: TaskStatus) => void;
  onDelete: () => void;
  onAddSub: () => void;
  onSubTitleChange: (v: string) => void;
  onSubCreate: () => void;
  onSubMove: (sub: Task, s: TaskStatus) => void;
  onSubDelete: (sub: Task) => void;
}): JSX.Element {
  const overdue = isOverdue(task);
  const subtasks = task.subtasks ?? [];
  const doneSubCount = subtasks.filter(s => s.status === "done").length;
  const hasSubtasks = subtasks.length > 0;

  return (
    <motion.div layout
      animate={{ borderColor: celebrating ? GREEN : overdue ? `${RED}55` : `${color}22`, boxShadow: celebrating ? `0 0 16px ${GREEN}44` : "none" }}
      style={{ padding: "10px 12px", background: celebrating ? `${GREEN}08` : overdue ? `${RED}05` : "rgba(255,255,255,0.03)", border: `1px solid ${color}22`, borderLeft: `3px solid ${overdue ? RED : color}`, borderRadius: 7, fontSize: 12 }}>

      {/* Header */}
      <div style={{ marginBottom: 6, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: 6 }}>
        {celebrating && <span>✅ </span>}
        <span style={{ flex: 1 }}>{task.title}</span>
        {task.isRecurring && <span style={{ fontSize: 9, color: GREEN, background: `${GREEN}15`, border: `1px solid ${GREEN}33`, padding: "1px 5px", borderRadius: 3, fontFamily: "'Share Tech Mono', monospace", flexShrink: 0 }}>↻ {task.recurrenceRule}</span>}
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 8, flexWrap: "wrap" }}>
        <span>E:{task.energy}</span>
        <span>P:{task.priority}</span>
        {task.estMinutes && <span>~{task.estMinutes}m</span>}
        {task.dueAt && (
          <span style={{ color: overdue ? RED : YELLOW, display: "flex", alignItems: "center", gap: 3 }}>
            {overdue ? "⚠" : "◷"} {fmtDate(task.dueAt)}
          </span>
        )}
        {hasSubtasks && (
          <button onClick={onToggleExpand}
            style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.1)`, color: "rgba(255,255,255,0.45)", borderRadius: 3, padding: "1px 6px", cursor: "pointer", fontSize: 9, fontFamily: "'Share Tech Mono', monospace" }}>
            {expanded ? "▲" : "▼"} {doneSubCount}/{subtasks.length} subs
          </button>
        )}
      </div>

      {/* Subtasks */}
      <AnimatePresence>
        {expanded && hasSubtasks && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 8 }}>
            <div style={{ borderLeft: `2px solid rgba(255,255,255,0.08)`, marginLeft: 6, paddingLeft: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {subtasks.map(sub => (
                <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 5 }}>
                  <button onClick={() => onSubMove(sub, sub.status === "done" ? "todo" : "done")}
                    style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${sub.status === "done" ? GREEN : "rgba(255,255,255,0.2)"}`, background: sub.status === "done" ? `${GREEN}30` : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {sub.status === "done" && <span style={{ fontSize: 8, color: GREEN }}>✓</span>}
                  </button>
                  <span style={{ flex: 1, fontSize: 11, color: sub.status === "done" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)", textDecoration: sub.status === "done" ? "line-through" : "none" }}>{sub.title}</span>
                  <button onClick={() => onSubDelete(sub)}
                    style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 10 }}>×</button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add subtask form */}
      <AnimatePresence>
        {addingSubHere && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={subTitle} onChange={e => onSubTitleChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onSubCreate()}
                placeholder="Sub-tarefa…"
                autoFocus
                style={{ flex: 1, padding: "5px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 11, fontFamily: "'Rajdhani', sans-serif", outline: "none" }} />
              <button onClick={onSubCreate}
                style={{ padding: "4px 8px", fontSize: 9, background: `${PURPLE}20`, border: `1px solid ${PURPLE}55`, color: PURPLE, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>+</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(["todo","doing","done"] as const).filter(s => s !== task.status).map(s => (
          <motion.button key={s} whileHover={{ scale: 1.05 }} onClick={() => onMove(s)}
            className="hud-label"
            style={{ padding: "2px 7px", fontSize: 8, background: s === "done" ? `${GREEN}10` : "transparent", border: `1px solid ${s === "done" ? `${GREEN}40` : "rgba(255,255,255,0.1)"}`, color: s === "done" ? GREEN : "rgba(255,255,255,0.4)", borderRadius: 3, cursor: "pointer" }}>
            → {s.toUpperCase()}
          </motion.button>
        ))}
        <button onClick={onAddSub}
          style={{ padding: "2px 7px", fontSize: 8, background: addingSubHere ? `${PURPLE}15` : "transparent", border: `1px solid ${addingSubHere ? PURPLE : "rgba(255,255,255,0.08)"}`, color: addingSubHere ? PURPLE : "rgba(255,255,255,0.3)", borderRadius: 3, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
          + SUB
        </button>
        <button onClick={onDelete}
          style={{ marginLeft: "auto", padding: "2px 7px", fontSize: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.6)", borderRadius: 3, cursor: "pointer" }}>×</button>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── DateTaskList ─────────────────────── */

function DateTaskList({ tasks, loading, dateLabel, onMove, onDelete }: {
  tasks: Task[]; loading: boolean; dateLabel: string;
  onMove: (t: Task, s: TaskStatus) => void;
  onDelete: (t: Task) => void;
}): JSX.Element {
  if (loading) return <LoadingMsg />;
  if (tasks.length === 0) return (
    <EmptyState icon="◷" title={`SEM TAREFAS — ${dateLabel}`} sub="Nenhuma tarefa com due date ou agendada para esta data." color={PURPLE} />
  );
  return (
    <div>
      <div className="hud-label" style={{ fontSize: 9, color: PURPLE, marginBottom: 12 }}>{dateLabel} · {tasks.length} tarefa{tasks.length > 1 ? "s" : ""}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map(t => {
          const overdue = isOverdue(t);
          return (
            <motion.div key={t.id} layout
              style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${overdue ? `${RED}30` : `${PURPLE}20`}`, borderLeft: `3px solid ${overdue ? RED : t.status === "done" ? GREEN : PURPLE}`, borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: t.status === "done" ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)", textDecoration: t.status === "done" ? "line-through" : "none", fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>{t.title}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", flexWrap: "wrap" }}>
                  {t.dueAt && <span style={{ color: overdue ? RED : YELLOW }}>◷ {fmtDate(t.dueAt)}</span>}
                  {t.scheduledFor && <span>📅 {fmtDate(t.scheduledFor)}</span>}
                  {t.isRecurring && <span style={{ color: GREEN }}>↻ {t.recurrenceRule}</span>}
                  <span style={{ padding: "1px 6px", border: `1px solid ${t.status === "done" ? `${GREEN}40` : "rgba(255,255,255,0.1)"}`, borderRadius: 3, color: t.status === "done" ? GREEN : "rgba(255,255,255,0.4)" }}>{t.status.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                {(["todo","doing","done"] as const).filter(s => s !== t.status).map(s => (
                  <button key={s} onClick={() => onMove(t, s)}
                    style={{ padding: "4px 8px", fontSize: 9, background: s === "done" ? `${GREEN}10` : "transparent", border: `1px solid ${s === "done" ? `${GREEN}33` : "rgba(255,255,255,0.1)"}`, color: s === "done" ? GREEN : "rgba(255,255,255,0.4)", borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                    {s.toUpperCase()}
                  </button>
                ))}
                <button onClick={() => onDelete(t)}
                  style={{ padding: "4px 6px", background: "transparent", border: `1px solid ${RED}25`, color: `${RED}88`, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>×</button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Helpers ──────────────────────────── */

function Stat({ label, value, color, onClick }: { label: string; value: string; color: string; onClick?: () => void }): JSX.Element {
  return (
    <div onClick={onClick}
      style={{ padding: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${color}18`, borderRadius: 8, textAlign: "center", cursor: onClick ? "pointer" : "default" }}>
      <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EnergySelect({ label, value, onChange, color }: { label: string; value: 1|2|3; onChange: (v: 1|2|3) => void; color: string }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{label}:</span>
      {([1,2,3] as const).map(n => (
        <button key={n} onClick={() => onChange(n)}
          style={{ width: 22, height: 22, fontSize: 10, background: value === n ? `${color}22` : "transparent", border: `1px solid ${value === n ? color : "rgba(255,255,255,0.1)"}`, color: value === n ? color : "rgba(255,255,255,0.35)", borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>{n}</button>
      ))}
    </div>
  );
}

function PrioritySelect({ label, value, onChange, color }: { label: string; value: 1|2|3; onChange: (v: 1|2|3) => void; color: string }): JSX.Element {
  return <EnergySelect label={label} value={value} onChange={onChange} color={color} />;
}

function LoadingMsg(): JSX.Element {
  return <div className="hud-label" style={{ color: "rgba(255,255,255,0.3)", padding: 40, textAlign: "center" }}>◌ carregando...</div>;
}

function EmptyState({ icon, title, sub, color }: { icon: string; title: string; sub: string; color: string }): JSX.Element {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "rgba(255,255,255,0.01)", border: `1px dashed ${color}20`, borderRadius: 12 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 6, fontFamily: "'Share Tech Mono', monospace" }}>{title}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{sub}</div>
    </div>
  );
}
