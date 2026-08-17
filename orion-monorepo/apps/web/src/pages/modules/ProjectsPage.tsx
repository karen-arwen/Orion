import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useProjects, useStalledProjects, useCreateProject, useUpdateProject,
  useDeleteProject, useAddMilestone, useCompleteMilestone, useRemoveMilestone,
} from "../../hooks/modules/useProjects.js";

const CYAN   = "#00D4FF";
const GOLD   = "#F59E0B";
const GREEN  = "#10B981";
const PURPLE = "#7C3AED";
const RED    = "#EF4444";
const ORANGE = "#F97316";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ativo:     { label: "ATIVO",     color: CYAN   },
  planejado: { label: "PLANEJADO", color: PURPLE },
  pausado:   { label: "PAUSADO",   color: GOLD   },
  concluido: { label: "CONCLUIDO", color: GREEN  },
  cancelado: { label: "CANCELADO", color: RED    },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:      { label: "BAIXA",    color: "rgba(255,255,255,0.3)" },
  medium:   { label: "MEDIA",    color: GOLD   },
  high:     { label: "ALTA",     color: ORANGE },
  critical: { label: "CRITICO",  color: RED    },
};

/* ── Circular progress ring ── */
function Ring({ pct, color, size = 56 }: { pct: number; color: string; size?: number }): JSX.Element {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }} />
    </svg>
  );
}

/* ── Timeline view ── */
interface TimelineProps {
  milestones: Array<{ id: string; title: string; completed: boolean; dueDate?: string; order: number; completedAt?: string }>;
  color: string;
  onComplete: (msId: string) => void;
  onDelete: (msId: string) => void;
}

function Timeline({ milestones, color, onComplete, onDelete }: TimelineProps): JSX.Element {
  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      {/* Vertical line */}
      {milestones.length > 1 && (
        <div style={{ position: "absolute", left: 8, top: 12, bottom: 12, width: 1, background: "rgba(255,255,255,0.08)" }} />
      )}
      {milestones.map((ms, i) => {
        const isOverdue = ms.dueDate && !ms.completed && new Date(ms.dueDate) < new Date();
        return (
          <motion.div key={ms.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, position: "relative" }}>
            {/* Node */}
            <div
              onClick={() => !ms.completed && onComplete(ms.id)}
              style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: ms.completed ? `${color}30` : "rgba(255,255,255,0.04)",
                border: `2px solid ${ms.completed ? color : isOverdue ? RED : "rgba(255,255,255,0.15)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: ms.completed ? "default" : "pointer",
                marginTop: 2,
                position: "relative", zIndex: 1,
              }}>
              {ms.completed && <span style={{ fontSize: 8, color }}>✓</span>}
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: ms.completed ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", textDecoration: ms.completed ? "line-through" : "none" }}>
                  {ms.title}
                </span>
                {isOverdue && <span style={{ fontSize: 7, color: RED, fontFamily: "'Share Tech Mono', monospace", background: `${RED}15`, padding: "1px 5px", borderRadius: 3 }}>ATRASADO</span>}
              </div>
              {ms.dueDate && (
                <div style={{ fontSize: 9, color: isOverdue ? RED : "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
                  {ms.completed ? `✓ ${ms.completedAt?.slice(0, 10) ?? ""}` : `Prazo: ${ms.dueDate}`}
                </div>
              )}
            </div>
            <button onClick={() => onDelete(ms.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 14, padding: 0, flexShrink: 0 }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = RED; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.1)"; }}>
              ×
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Project Card ── */
type ProjectData = {
  id: string; name: string; color: string; progress: number; status: string;
  meta: { description?: string; dueDate?: string; tags: string[]; priority: string; lastActivityAt: string };
  milestones: Array<{ id: string; title: string; completed: boolean; dueDate?: string; order: number; completedAt?: string }>;
  updates: Array<{ id: string; note: string; progressDelta?: number; createdAt: string }>;
  isStalled: boolean; stalledDays: number; nextMilestone?: { id: string; title: string; dueDate?: string };
  completedMilestones: number; totalMilestones: number;
};

interface ProjectCardProps {
  project: ProjectData;
  onSelect: () => void;
  isSelected: boolean;
  onDelete: () => void;
}

function ProjectCard({ project, onSelect, isSelected, onDelete }: ProjectCardProps): JSX.Element {
  const statusCfg = STATUS_CONFIG[project.status] ?? { label: project.status.toUpperCase(), color: CYAN };
  const priorityCfg = PRIORITY_CONFIG[project.meta.priority] ?? { label: "MEDIA", color: GOLD };
  const c = project.color;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onSelect}
      style={{
        padding: "18px 20px",
        background: isSelected ? `${c}08` : "rgba(255,255,255,0.02)",
        border: `1px solid ${isSelected ? c + "40" : project.isStalled ? GOLD + "25" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 12, cursor: "pointer",
        position: "relative", overflow: "hidden",
      }}>
      {project.isStalled && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${GOLD}60, ${ORANGE}60)` }} />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
        <Ring pct={project.progress} color={c} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.9)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {project.name}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, padding: "2px 7px", background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}30`, borderRadius: 3, color: statusCfg.color, fontFamily: "'Share Tech Mono', monospace" }}>
              {statusCfg.label}
            </span>
            <span style={{ fontSize: 8, color: priorityCfg.color, fontFamily: "'Share Tech Mono', monospace" }}>
              {priorityCfg.label}
            </span>
            <span style={{ fontSize: 12, fontFamily: "'Share Tech Mono', monospace", color: c, fontWeight: "bold" }}>
              {project.progress}%
            </span>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 16, flexShrink: 0 }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = RED; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.1)"; }}>
          ×
        </button>
      </div>

      {project.meta.description && (
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
          {project.meta.description}
        </p>
      )}

      {/* Milestone mini-progress */}
      {project.totalMilestones > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace" }}>
              MARCOS: {project.completedMilestones}/{project.totalMilestones}
            </span>
            {project.nextMilestone && (
              <span style={{ fontSize: 8, color: c, fontFamily: "'Share Tech Mono', monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                → {project.nextMilestone.title}
              </span>
            )}
          </div>
          <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(project.completedMilestones / project.totalMilestones) * 100}%`, background: c, borderRadius: 1, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Stalled warning */}
      {project.isStalled && (
        <div style={{ padding: "6px 10px", background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderRadius: 6, fontSize: 9, color: GOLD, fontFamily: "'Share Tech Mono', monospace" }}>
          ⚠ {project.stalledDays} DIAS SEM ATIVIDADE
        </div>
      )}

      {/* Tags */}
      {project.meta.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
          {project.meta.tags.map(t => (
            <span key={t} style={{ fontSize: 8, padding: "2px 7px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, color: "rgba(255,255,255,0.35)", fontFamily: "'Rajdhani', sans-serif" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Due date */}
      {project.meta.dueDate && (
        <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace" }}>
          PRAZO: {project.meta.dueDate}
        </div>
      )}
    </motion.div>
  );
}

/* ── Detail Panel ── */
function ProjectDetail({ project }: { project: ProjectData }): JSX.Element {
  const [newMs, setNewMs] = useState("");
  const [newMsDue, setNewMsDue] = useState("");
  const [noteText, setNoteText] = useState("");
  const [progress, setProgress] = useState(project.progress);
  const addMilestone = useAddMilestone();
  const completeMilestone = useCompleteMilestone();
  const removeMilestone = useRemoveMilestone();
  const updateProject = useUpdateProject();

  const submitMs = (): void => {
    if (!newMs.trim()) return;
    void addMilestone.mutateAsync({ id: project.id, input: { title: newMs.trim(), dueDate: newMsDue || undefined } });
    setNewMs(""); setNewMsDue("");
  };

  const submitUpdate = (): void => {
    if (!noteText.trim() && progress === project.progress) return;
    void updateProject.mutateAsync({ id: project.id, patch: { progress, note: noteText.trim() || undefined } });
    setNoteText("");
  };

  const c = project.color;
  const statusCfg = STATUS_CONFIG[project.status] ?? { label: project.status.toUpperCase(), color: CYAN };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Ring pct={project.progress} color={c} size={72} />
        <div>
          <div style={{ fontSize: 16, fontFamily: "'Share Tech Mono', monospace", color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>{project.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 9, padding: "3px 9px", background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}30`, borderRadius: 4, color: statusCfg.color, fontFamily: "'Share Tech Mono', monospace" }}>
              {statusCfg.label}
            </span>
            <span style={{ fontSize: 18, fontFamily: "'Share Tech Mono', monospace", color: c, fontWeight: "bold" }}>{project.progress}%</span>
          </div>
          {project.isStalled && (
            <div style={{ marginTop: 6, fontSize: 9, color: GOLD, fontFamily: "'Share Tech Mono', monospace" }}>
              ⚠ Parado há {project.stalledDays} dias
            </div>
          )}
        </div>
      </div>

      {/* Update progress */}
      <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 10 }}>ATUALIZAR PROGRESSO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))}
            style={{ flex: 1, accentColor: c }} />
          <span style={{ fontSize: 13, fontFamily: "'Share Tech Mono', monospace", color: c, width: 36, textAlign: "right" }}>{progress}%</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Nota opcional sobre o progresso..."
            onKeyDown={e => e.key === "Enter" && submitUpdate()}
            style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", fontSize: 11, outline: "none" }} />
          <button onClick={submitUpdate} style={{ padding: "8px 16px", background: `${c}15`, border: `1px solid ${c}40`, color: c, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9 }}>
            SALVAR
          </button>
        </div>
      </div>

      {/* Status toggle */}
      <div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>STATUS</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => void updateProject.mutateAsync({ id: project.id, patch: { status: key } })}
              style={{ padding: "6px 12px", background: project.status === key ? `${cfg.color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${project.status === key ? cfg.color + "50" : "rgba(255,255,255,0.06)"}`, color: project.status === key ? cfg.color : "rgba(255,255,255,0.3)", borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 8 }}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 12 }}>
          MARCOS ({project.completedMilestones}/{project.totalMilestones})
        </div>
        {project.milestones.length > 0 && (
          <Timeline
            milestones={project.milestones}
            color={c}
            onComplete={msId => void completeMilestone.mutateAsync({ id: project.id, msId })}
            onDelete={msId => void removeMilestone.mutateAsync({ id: project.id, msId })}
          />
        )}
        {/* Add milestone */}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newMs} onChange={e => setNewMs(e.target.value)} onKeyDown={e => e.key === "Enter" && submitMs()} placeholder="Novo marco..."
            style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", fontSize: 11, outline: "none" }} />
          <input value={newMsDue} onChange={e => setNewMsDue(e.target.value)} type="date"
            style={{ width: 130, padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontFamily: "'Rajdhani', sans-serif", fontSize: 11, outline: "none", colorScheme: "dark" }} />
          <button onClick={submitMs} disabled={!newMs.trim()}
            style={{ padding: "8px 14px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 8, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, opacity: newMs.trim() ? 1 : 0.4 }}>+</button>
        </div>
      </div>

      {/* Update log */}
      {project.updates.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 10 }}>HISTORICO DE ATUALIZACOES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {project.updates.map(u => (
              <div key={u.id} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace" }}>{u.createdAt.slice(0, 10)}</span>
                  {u.progressDelta !== undefined && (
                    <span style={{ fontSize: 8, color: u.progressDelta >= 0 ? GREEN : RED, fontFamily: "'Share Tech Mono', monospace" }}>
                      {u.progressDelta >= 0 ? "+" : ""}{u.progressDelta}%
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.4 }}>{u.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create Modal ── */
function CreateModal({ onSave, onClose }: { onSave: (d: Record<string, unknown>) => void; onClose: () => void }): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [color, setColor] = useState("#00D4FF");
  const [priority, setPriority] = useState("medium");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const COLORS = ["#00D4FF", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#F97316", "#6366F1"];

  const addTag = (): void => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(s => [...s, t]);
    setTagInput("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(3,5,9,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: "min(500px, 95vw)", background: "rgba(3,5,9,0.98)", border: `1px solid ${PURPLE}30`, borderRadius: 16, overflow: "hidden", boxShadow: `0 0 60px ${PURPLE}15` }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "'Share Tech Mono', monospace", color: PURPLE, letterSpacing: "0.1em" }}>NOVO PROJETO</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>NOME *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do projeto"
              style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>DESCRICAO</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Contexto, objetivo..."
              style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>PRAZO</label>
              <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date"
                style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, outline: "none", colorScheme: "dark", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>PRIORIDADE</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, outline: "none", boxSizing: "border-box" }}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 8 }}>COR</label>
            <div style={{ display: "flex", gap: 8 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: `2px solid ${color === c ? "white" : "transparent"}`, cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", display: "block", marginBottom: 6 }}>TAGS</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {tags.map(t => (
                <span key={t} onClick={() => setTags(s => s.filter(x => x !== t))}
                  style={{ fontSize: 9, padding: "2px 8px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}30`, borderRadius: 20, color: PURPLE, cursor: "pointer" }}>
                  {t} ×
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} placeholder="tag..."
                style={{ flex: 1, padding: "7px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif", fontSize: 11, outline: "none" }} />
              <button onClick={addTag} style={{ padding: "7px 12px", background: `${PURPLE}12`, border: `1px solid ${PURPLE}30`, color: PURPLE, borderRadius: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9 }}>+</button>
            </div>
          </div>
          <button onClick={() => { if (name.trim()) onSave({ name: name.trim(), description, dueDate: dueDate || undefined, color, priority, tags }); }}
            disabled={!name.trim()}
            style={{ padding: "12px", background: `linear-gradient(135deg, ${PURPLE}20, ${CYAN}20)`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: "0.1em", opacity: name.trim() ? 1 : 0.4 }}>
            CRIAR PROJETO
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
export function ProjectsPage(): JSX.Element {
  const { data: projects = [], isLoading } = useProjects();
  const { data: stalled = [] } = useStalledProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "ativo" | "concluido" | "stalled">("all");

  const selected = projects.find(p => p.id === selectedId) ?? null;

  const filtered = projects.filter(p => {
    if (filter === "stalled") return p.isStalled;
    if (filter === "all") return true;
    return p.status === filter;
  });

  const activeCount = projects.filter(p => p.status === "ativo").length;
  const stalledCount = projects.filter(p => p.isStalled).length;
  const doneCount = projects.filter(p => p.status === "concluido").length;
  const avgProgress = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#030509", color: "rgba(255,255,255,0.85)", fontFamily: "'Rajdhani', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ color: PURPLE, fontSize: 18 }}>▲</span>
            <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Share Tech Mono', monospace", color: PURPLE, letterSpacing: "0.15em", textShadow: `0 0 18px ${PURPLE}40` }}>
              PROJETOS
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace" }}>
            {projects.length} projetos · {activeCount} ativos · {stalledCount > 0 ? `⚠ ${stalledCount} parados · ` : ""}{doneCount} concluidos
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: "10px 20px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
          + NOVO PROJETO
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "PROJETOS", value: String(projects.length), color: CYAN },
          { label: "ATIVOS", value: String(activeCount), color: PURPLE },
          { label: "PROGRESSO MEDIO", value: `${avgProgress}%`, color: GREEN },
          { label: "PARADOS", value: String(stalledCount), color: stalledCount > 0 ? GOLD : "rgba(255,255,255,0.3)" },
          { label: "CONCLUIDOS", value: String(doneCount), color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontFamily: "'Share Tech Mono', monospace", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Stalled alert */}
      {stalled.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ padding: "14px 18px", background: `${GOLD}06`, border: `1px solid ${GOLD}20`, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: GOLD, fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>⚠ ORION DETECTOU {stalled.length} PROJETO(S) PARADO(S)</div>
          {stalled.map(s => (
            <div key={s.projectId} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "'Share Tech Mono', monospace", flexShrink: 0 }}>{s.name}:</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.4 }}>{s.suggestion}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {([["all", "TODOS"], ["ativo", "ATIVOS"], ["concluido", "CONCLUIDOS"], ["stalled", "PARADOS"]] as ["all" | "ativo" | "concluido" | "stalled", string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{ padding: "10px 18px", background: "none", border: "none", borderBottom: `2px solid ${filter === id ? PURPLE : "transparent"}`, color: filter === id ? PURPLE : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: "0.08em", transition: "all 0.2s" }}>
            {label}{id === "stalled" && stalledCount > 0 ? ` (${stalledCount})` : ""}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.4fr" : "1fr", gap: 20 }}>
        {/* Cards */}
        <div>
          {isLoading && <div style={{ color: CYAN, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>◌ CARREGANDO...</div>}

          {!isLoading && filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>▲</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Share Tech Mono', monospace", marginBottom: 20 }}>
                {filter === "stalled" ? "NENHUM PROJETO PARADO" : "NENHUM PROJETO AQUI"}
              </div>
              {filter === "all" && (
                <button onClick={() => setShowCreate(true)}
                  style={{ padding: "12px 28px", background: `${PURPLE}15`, border: `1px solid ${PURPLE}40`, color: PURPLE, borderRadius: 10, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
                  CRIAR PRIMEIRO PROJETO
                </button>
              )}
            </motion.div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                isSelected={selectedId === p.id}
                onSelect={() => setSelectedId(selectedId === p.id ? null : p.id)}
                onDelete={() => { if (selectedId === p.id) setSelectedId(null); void deleteProject.mutateAsync(p.id); }}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ padding: "20px 22px", background: "rgba(255,255,255,0.015)", border: `1px solid ${selected.color}20`, borderRadius: 14, maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace" }}>DETALHES DO PROJETO</span>
                <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
              <ProjectDetail project={selected} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onSave={data => { void createProject.mutateAsync(data).then(() => setShowCreate(false)); }}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
