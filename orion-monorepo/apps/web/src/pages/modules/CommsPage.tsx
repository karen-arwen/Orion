import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useCommsInbox,
  useCommsSummary,
  useReadEmail,
  useDraftReply,
  useSendReply,
  useArchiveEmail,
  useSnoozeEmail,
  useCreateTaskFromEmail,
} from "../../hooks/modules/useComms.js";

const CYAN   = "#00D4FF";
const PURPLE = "#7C3AED";
const GREEN  = "#10B981";
const RED    = "#EF4444";
const YELLOW = "#F59E0B";

const URGENCY: Record<string, { label: string; color: string; dot: string }> = {
  urgent:   { label: "URGENTE",   color: RED,    dot: "●" },
  relevant: { label: "RELEVANTE", color: CYAN,   dot: "○" },
  noise:    { label: "RUÍDO",     color: "rgba(255,255,255,0.2)", dot: "·" },
};

type Filter = "all" | "unread" | "starred";

const SNOOZE_OPTS = [
  { label: "1 hora",  hours: 1 },
  { label: "Amanhã",  hours: 24 },
  { label: "3 dias",  hours: 72 },
  { label: "1 semana", hours: 168 },
];

function fmtFrom(from: string): string {
  const m = /^"?([^"<]+)"?\s*</.exec(from);
  return m ? m[1]!.trim() : from.split("@")[0] ?? from;
}

export function CommsPage(): JSX.Element {
  const [filter, setFilter]         = useState<Filter>("all");
  const [showSummary, setShowSummary] = useState(false);
  const [openId, setOpenId]         = useState<string | null>(null);
  const [replyBody, setReplyBody]   = useState("");
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [snoozeFor, setSnoozeFor]   = useState<string | null>(null);
  const [taskTitle, setTaskTitle]   = useState("");
  const [showTaskForm, setShowTaskForm] = useState<string | null>(null);
  const [archived, setArchived]     = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg]     = useState<string | null>(null);

  const inbox   = useCommsInbox(filter);
  const summary = useCommsSummary(showSummary);
  const emailQ  = useReadEmail(openId);
  const draft   = useDraftReply();
  const send    = useSendReply();
  const archive = useArchiveEmail();
  const snooze  = useSnoozeEmail();
  const mkTask  = useCreateTaskFromEmail();

  const visibleItems = (inbox.data ?? []).filter(m => !archived.has(m.id));
  const urgent   = visibleItems.filter(m => m.urgency === "urgent");
  const relevant = visibleItems.filter(m => m.urgency === "relevant");
  const noise    = visibleItems.filter(m => m.urgency === "noise");

  const toast = (msg: string): void => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openEmail = (id: string): void => {
    setOpenId(id);
    setReplyBody("");
    setShowReplyBox(false);
  };

  const handleDraft = (emailId: string): void => {
    draft.mutate({ id: emailId }, {
      onSuccess: (data) => { setReplyBody(data.draft); setShowReplyBox(true); },
    });
  };

  const handleSend = (email: { id: string; threadId: string; from: string; subject: string }): void => {
    if (!replyBody.trim()) return;
    send.mutate({
      id: email.id,
      payload: {
        threadId: email.threadId,
        to: email.from,
        subject: email.subject,
        body: replyBody,
      },
    }, {
      onSuccess: () => {
        toast("✓ Email enviado!"); setShowReplyBox(false); setReplyBody(""); setOpenId(null);
      },
    });
  };

  const handleArchive = (id: string): void => {
    archive.mutate(id, {
      onSuccess: () => { setArchived(prev => new Set([...prev, id])); if (openId === id) setOpenId(null); toast("Arquivado"); },
    });
  };

  const handleSnooze = (email: { id: string; subject: string; from: string }, hours: number): void => {
    const until = new Date(Date.now() + hours * 3600_000);
    snooze.mutate({
      id: email.id,
      payload: { subject: email.subject, from: email.from, snoozeUntil: until.toISOString() },
    }, {
      onSuccess: () => {
        setArchived(prev => new Set([...prev, email.id]));
        if (openId === email.id) setOpenId(null);
        setSnoozeFor(null);
        toast(`Adiado por ${hours >= 24 ? `${hours / 24}d` : `${hours}h`}`);
      },
    });
  };

  const handleCreateTask = (emailId: string): void => {
    mkTask.mutate({ id: emailId, payload: { customTitle: taskTitle || undefined } }, {
      onSuccess: () => { toast("✓ Tarefa criada no Life OS"); setShowTaskForm(null); setTaskTitle(""); },
    });
  };

  const openEmail_ = inbox.data?.find(m => m.id === openId);

  return (
    <ModuleShell icon="◈" label="COMMS" sub="Gmail · Reply inline · AI draft · Snooze" color={CYAN}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "10px 22px", background: `linear-gradient(135deg, ${CYAN}CC, ${PURPLE}AA)`, borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "'Share Tech Mono', monospace" }}>
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {(["all","unread","starred"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="hud-label"
              style={{ padding: "7px 13px", fontSize: 9, background: filter === f ? `${CYAN}15` : "transparent", border: `1px solid ${filter === f ? CYAN : "rgba(255,255,255,0.1)"}`, color: filter === f ? CYAN : "rgba(255,255,255,0.4)", borderRadius: 5, cursor: "pointer" }}>
              {f === "all" ? "◈ TODOS" : f === "unread" ? "● NÃO LIDOS" : "★ MARCADOS"}
            </button>
          ))}
          <button onClick={() => inbox.refetch()} className="hud-label"
            style={{ padding: "7px 12px", fontSize: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", borderRadius: 5, cursor: "pointer", marginLeft: "auto" }}>
            ↻ {inbox.isFetching ? "ATUALIZANDO..." : "ATUALIZAR"}
          </button>
          <button onClick={() => setShowSummary(p => !p)} className="hud-label"
            style={{ padding: "7px 12px", fontSize: 9, background: showSummary ? `${PURPLE}18` : "transparent", border: `1px solid ${showSummary ? PURPLE : "rgba(255,255,255,0.08)"}`, color: showSummary ? PURPLE : "rgba(255,255,255,0.35)", borderRadius: 5, cursor: "pointer" }}>
            ✦ RESUMO IA
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { label: "URGENTE", value: urgent.length, color: RED },
            { label: "RELEVANTE", value: relevant.length, color: CYAN },
            { label: "RUÍDO", value: noise.length, color: "rgba(255,255,255,0.25)" },
          ].map(s => (
            <div key={s.label} style={{ padding: 10, textAlign: "center", background: "rgba(255,255,255,0.02)", border: `1px solid ${s.color}18`, borderRadius: 8 }}>
              <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontFamily: "'Share Tech Mono', monospace", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        <AnimatePresence>
          {showSummary && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 16 }}>
              <div style={{ padding: 16, background: `linear-gradient(135deg, ${PURPLE}10, transparent)`, border: `1px solid ${PURPLE}30`, borderRadius: 10 }}>
                <div className="hud-label" style={{ color: PURPLE, fontSize: 9, marginBottom: 8 }}>✦ RESUMO EXECUTIVO ORION</div>
                <div style={{ whiteSpace: "pre-wrap", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.7 }}>
                  {summary.isLoading ? "◌ gerando análise..." : summary.data?.summary ?? "—"}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email reader panel */}
        <AnimatePresence>
          {openId && openEmail_ && (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              style={{ marginBottom: 16, background: "rgba(255,255,255,0.025)", border: `1px solid ${CYAN}30`, borderRadius: 12, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${CYAN}15`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 15, color: "rgba(255,255,255,0.92)", marginBottom: 4 }}>{openEmail_.subject}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    De: <strong style={{ color: "rgba(255,255,255,0.65)" }}>{openEmail_.from}</strong>
                    <span style={{ margin: "0 8px" }}>·</span>{openEmail_.date}
                  </div>
                </div>
                <button onClick={() => setOpenId(null)}
                  style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>

              {/* Body */}
              <div style={{ padding: "16px 18px", maxHeight: 300, overflowY: "auto" }}>
                {emailQ.isLoading
                  ? <div className="hud-label" style={{ color: "rgba(255,255,255,0.3)" }}>◌ carregando email...</div>
                  : <pre style={{ whiteSpace: "pre-wrap", fontFamily: "'Rajdhani', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, margin: 0 }}>{emailQ.data?.body}</pre>
                }
              </div>

              {/* Action bar */}
              <div style={{ padding: "12px 18px", borderTop: `1px solid rgba(255,255,255,0.05)`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <motion.button whileHover={{ scale: 1.03 }}
                  onClick={() => { setShowReplyBox(p => !p); if (!showReplyBox) setReplyBody(""); }}
                  style={{ padding: "7px 14px", fontSize: 10, background: showReplyBox ? `${CYAN}18` : `${CYAN}08`, border: `1px solid ${CYAN}44`, color: CYAN, borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  ↩ RESPONDER
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} onClick={() => handleDraft(openId)} disabled={draft.isPending}
                  style={{ padding: "7px 14px", fontSize: 10, background: `${PURPLE}10`, border: `1px solid ${PURPLE}44`, color: PURPLE, borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  {draft.isPending ? "◌ GERANDO..." : "✦ RASCUNHO IA"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} onClick={() => handleArchive(openId)}
                  style={{ padding: "7px 12px", fontSize: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                  ○ ARQUIVAR
                </motion.button>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setSnoozeFor(snoozeFor === openId ? null : openId)}
                    style={{ padding: "7px 12px", fontSize: 10, background: snoozeFor === openId ? `${YELLOW}10` : "transparent", border: `1px solid ${snoozeFor === openId ? YELLOW : "rgba(255,255,255,0.1)"}`, color: snoozeFor === openId ? YELLOW : "rgba(255,255,255,0.4)", borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                    ◷ ADIAR
                  </button>
                  <AnimatePresence>
                    {snoozeFor === openId && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                        style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "#0A0F16", border: `1px solid ${YELLOW}44`, borderRadius: 8, padding: 8, zIndex: 50, minWidth: 140 }}>
                        {SNOOZE_OPTS.map(o => (
                          <button key={o.hours} onClick={() => handleSnooze(openEmail_!, o.hours)}
                            style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: 11, background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "left", fontFamily: "'Share Tech Mono', monospace" }}
                            onMouseEnter={e => (e.currentTarget.style.background = `${YELLOW}10`)}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            {o.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowTaskForm(showTaskForm === openId ? null : openId)}
                    style={{ padding: "7px 12px", fontSize: 10, background: showTaskForm === openId ? `${GREEN}10` : "transparent", border: `1px solid ${showTaskForm === openId ? GREEN : "rgba(255,255,255,0.1)"}`, color: showTaskForm === openId ? GREEN : "rgba(255,255,255,0.4)", borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                    + TAREFA
                  </button>
                  <AnimatePresence>
                    {showTaskForm === openId && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                        style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "#0A0F16", border: `1px solid ${GREEN}44`, borderRadius: 8, padding: 12, zIndex: 50, minWidth: 260 }}>
                        <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>TÍTULO DA TAREFA</div>
                        <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                          placeholder={`Email: ${openEmail_!.subject}`}
                          style={{ width: "100%", padding: "6px 8px", background: "rgba(255,255,255,0.04)", border: `1px solid ${GREEN}33`, borderRadius: 4, color: "#fff", fontSize: 11, fontFamily: "'Rajdhani', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                        <button onClick={() => handleCreateTask(openId)} disabled={mkTask.isPending}
                          style={{ padding: "6px 12px", fontSize: 10, background: `${GREEN}15`, border: `1px solid ${GREEN}55`, color: GREEN, borderRadius: 4, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                          {mkTask.isPending ? "◌" : "✓ CRIAR"}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Reply box */}
              <AnimatePresence>
                {showReplyBox && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden", borderTop: `1px solid ${CYAN}20` }}>
                    <div style={{ padding: "12px 18px" }}>
                      <div className="hud-label" style={{ fontSize: 8, color: CYAN, marginBottom: 8 }}>
                        ↩ RESPOSTA PARA {fmtFrom(openEmail_?.from ?? "")}
                      </div>
                      <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={5}
                        placeholder="Escreva sua resposta ou clique em 'Rascunho IA' para o ORION gerar…"
                        style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: `1px solid ${CYAN}22`, borderRadius: 7, color: "#fff", fontSize: 12.5, fontFamily: "'Rajdhani', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <motion.button whileHover={{ scale: 1.03 }}
                          onClick={() => handleSend({ id: openId, threadId: openEmail_!.threadId, from: openEmail_!.from, subject: openEmail_!.subject })}
                          disabled={!replyBody.trim() || send.isPending}
                          style={{ padding: "8px 18px", fontSize: 10, background: `${CYAN}15`, border: `1px solid ${CYAN}`, color: CYAN, borderRadius: 5, cursor: replyBody.trim() ? "pointer" : "not-allowed", opacity: replyBody.trim() ? 1 : 0.4, fontFamily: "'Share Tech Mono', monospace", boxShadow: `0 0 8px ${CYAN}22` }}>
                          {send.isPending ? "◌ ENVIANDO..." : "▷ ENVIAR"}
                        </motion.button>
                        <button onClick={() => { setShowReplyBox(false); setReplyBody(""); }}
                          style={{ padding: "8px 14px", fontSize: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading / Error */}
        {inbox.isLoading && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.35)", padding: 48, textAlign: "center" }}>◌ classificando emails com IA...</div>
        )}
        {inbox.error && (
          <div style={{ padding: 16, background: `${RED}08`, border: `1px solid ${RED}25`, borderRadius: 8, color: RED, fontSize: 12 }}>
            ✗ {(inbox.error as Error).message}
          </div>
        )}

        {/* Email list by urgency */}
        {inbox.data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {([
              { key: "urgent",   items: urgent },
              { key: "relevant", items: relevant },
              { key: "noise",    items: noise },
            ] as const).map(({ key, items }) => {
              if (items.length === 0) return null;
              const meta = URGENCY[key]!;
              return (
                <div key={key}>
                  <div className="hud-label" style={{ fontSize: 9, color: meta.color, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{meta.dot}</span> {meta.label} · {items.length}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.map(email => {
                      const isOpen = openId === email.id;
                      return (
                        <motion.div key={email.id} layout
                          whileHover={{ borderColor: `${meta.color}44` }}
                          onClick={() => openEmail(email.id)}
                          style={{ padding: "12px 16px", background: isOpen ? `${meta.color}06` : "rgba(255,255,255,0.02)", border: `1px solid ${isOpen ? meta.color + "44" : "rgba(255,255,255,0.06)"}`, borderLeft: `3px solid ${meta.color}`, borderRadius: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <strong style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontFamily: "'Share Tech Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{fmtFrom(email.from)}</strong>
                              {email.unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />}
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: "auto", whiteSpace: "nowrap" }}>{email.date?.split(" ").slice(0,3).join(" ")}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.subject}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.reason || email.snippet}</div>
                          </div>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleDraft(email.id)} title="Rascunho IA"
                              style={{ padding: "4px 7px", fontSize: 9, background: `${PURPLE}10`, border: `1px solid ${PURPLE}33`, color: PURPLE, borderRadius: 4, cursor: "pointer" }}>✦</button>
                            <button onClick={() => handleArchive(email.id)} title="Arquivar"
                              style={{ padding: "4px 7px", fontSize: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", borderRadius: 4, cursor: "pointer" }}>○</button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {visibleItems.length === 0 && !inbox.isLoading && (
              <div style={{ padding: 48, textAlign: "center", border: `1px dashed ${CYAN}20`, borderRadius: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>◈</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'Share Tech Mono', monospace" }}>CAIXA VAZIA</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>Nenhum email nos últimos 3 dias</div>
              </div>
            )}
          </div>
        )}
      </div>

      <ModuleChat
        module="comms"
        label="COMMS"
        color={CYAN}
        welcome="Posso ler seus emails, redigir respostas, resumir a caixa e criar tarefas a partir de mensagens. O que fazer?"
        suggestions={["Resumir emails de hoje", "Rascunhar resposta", "Emails urgentes", "Criar tarefa do email"]}
      />
    </ModuleShell>
  );
}
