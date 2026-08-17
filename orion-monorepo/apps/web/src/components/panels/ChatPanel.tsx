import { SmartShortcuts } from "./SmartShortcuts.js";
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";
import { Mic, MicOff, Paperclip, Send, Volume2, VolumeX, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, UserProfile } from "@orion/types";
import { ChatMsg } from "./ChatMsg.js";
import { ToolIndicator } from "./ToolIndicator.js";
import type { ActiveTool } from "../../stores/chat.store.js";
import { QUICK_COMMANDS } from "../../lib/constants.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

/* ─── Module mentions ─── */
const MODULES = [
  { id: "life",      label: "Life OS",       icon: "◈" },
  { id: "comms",     label: "COMMS",         icon: "✉" },
  { id: "finance",   label: "Finanças",      icon: "◈" },
  { id: "agenda",    label: "Agenda",        icon: "⬡" },
  { id: "health",    label: "Saúde",         icon: "◎" },
  { id: "habits",    label: "Hábitos",       icon: "▸" },
  { id: "focus",     label: "Foco",          icon: "◉" },
  { id: "career",    label: "Carreira",      icon: "▲" },
  { id: "knowledge", label: "Conhecimento",  icon: "◇" },
  { id: "chef",      label: "Chef",          icon: "✦" },
  { id: "shop",      label: "Compras",       icon: "◧" },
  { id: "travel",    label: "Viagem",        icon: "✦" },
  { id: "social",    label: "Social",        icon: "◎" },
  { id: "media",     label: "Mídia",         icon: "▸" },
  { id: "sleep",     label: "Sono",          icon: "◌" },
  { id: "creative",  label: "Criação",       icon: "✦" },
];

/* ─── Slash commands ─── */
const SLASH_CMDS = [
  { cmd: "/resumo",    label: "Resumo da sessão",    detail: "Gera resumo executivo desta conversa" },
  { cmd: "/tarefa",    label: "Criar tarefa",        detail: "Cria uma tarefa no Life OS" },
  { cmd: "/analisar",  label: "Analisar",            detail: "Analisa o conteúdo ou situação" },
  { cmd: "/planejar",  label: "Planejar",            detail: "Cria um plano de ação detalhado" },
  { cmd: "/lembrete",  label: "Criar lembrete",      detail: "Agenda um lembrete" },
  { cmd: "/pesquisar", label: "Pesquisar",           detail: "Busca informação atualizada" },
  { cmd: "/comparar",  label: "Comparar opções",     detail: "Compara cenários ou produtos" },
  { cmd: "/melhorar",  label: "Melhorar texto",      detail: "Reescreve ou aprimora o texto" },
  { cmd: "/traduzir",  label: "Traduzir",            detail: "Traduz para outro idioma" },
  { cmd: "/explicar",  label: "Explicar",            detail: "Explica de forma simples" },
];

interface ChatPanelProps {
  profile: UserProfile;
  messages: ChatMessage[];
  loading: boolean;
  activeTools?: ActiveTool[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: (override?: string) => void;
}

export function ChatPanel({
  profile,
  messages,
  loading,
  activeTools = [],
  input,
  onInputChange,
  onSend,
}: ChatPanelProps): JSX.Element {
  const chatEndRef     = useRef<HTMLDivElement | null>(null);
  const textareaRef    = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef   = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenRef  = useRef<string>("");
  const [listening, setListening]   = useState(false);
  const [voiceReply, setVoiceReply] = useState(false);
  const [showToast, setShowToast]   = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; base64: string; type: string } | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const color = profile.theme.primary;
  const qc = useQueryClient();

  // @mention
  const [mentionOpen, setMentionOpen]   = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIdx, setMentionIdx]     = useState(0);

  // /slash
  const [slashOpen, setSlashOpen]   = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx]     = useState(0);

  const createTask = useMutation({
    mutationFn: (title: string) => api.life.create({ title }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life"] });
      showToastMsg("✓ Tarefa criada no Life OS");
    },
  });

  function showToastMsg(msg: string): void {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 2800);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Auto-resize textarea ── */
  const autoResize = (): void => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  };

  useEffect(() => { autoResize(); }, [input]);

  useEffect(() => {
    if (!voiceReply) return;
    const last = [...messages].reverse().find(m => m.role === "assistant" && !m.loading);
    if (!last?.content || last.content === lastSpokenRef.current) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(last.content.replace(/[`*_#>-]/g, " "));
    utt.lang = profile.language || "pt-BR";
    utt.rate = 1.02; utt.pitch = 0.92;
    lastSpokenRef.current = last.content;
    synth.speak(utt);
  }, [messages, profile.language, voiceReply]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  /* ── Input change — detect @ and / triggers ── */
  function handleInputChange(val: string): void {
    onInputChange(val);

    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]?.toLowerCase() ?? "");
      setMentionOpen(true);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }

    const slashMatch = val.match(/\/(\w*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1]?.toLowerCase() ?? "");
      setSlashOpen(true);
      setSlashIdx(0);
    } else {
      setSlashOpen(false);
    }
  }

  const filteredModules = MODULES.filter(m =>
    !mentionQuery || m.label.toLowerCase().includes(mentionQuery) || m.id.includes(mentionQuery)
  ).slice(0, 7);

  const filteredSlash = SLASH_CMDS.filter(s =>
    !slashQuery || s.cmd.slice(1).includes(slashQuery) || s.label.toLowerCase().includes(slashQuery)
  ).slice(0, 7);

  function pickMention(mod: typeof MODULES[0]): void {
    onInputChange(input.replace(/@\w*$/, `@${mod.label} `));
    setMentionOpen(false);
    textareaRef.current?.focus();
  }

  function pickSlash(s: typeof SLASH_CMDS[0]): void {
    onInputChange(input.replace(/\/\w*$/, `${s.cmd} `));
    setSlashOpen(false);
    textareaRef.current?.focus();
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mentionOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredModules.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); const m = filteredModules[mentionIdx]; if (m) pickMention(m); return; }
      if (e.key === "Escape")    { setMentionOpen(false); return; }
    }
    if (slashOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, filteredSlash.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); const s = filteredSlash[slashIdx]; if (s) pickSlash(s); return; }
      if (e.key === "Escape")    { setSlashOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const toggleDictation = (): void => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) { onInputChange(`${input}${input ? "\n" : ""}Ditado por voz indisponível neste navegador.`); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new Ctor();
    rec.lang = profile.language || "pt-BR";
    rec.continuous = false; rec.interimResults = true;
    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      const t = Array.from(ev.results).map(r => r[0]?.transcript ?? "").join(" ").trim();
      if (t) onInputChange(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  function handleSaveAsTask(content: string): void {
    const title = content.split(/[.\n]/)[0]?.trim().slice(0, 120) ?? content.slice(0, 80);
    createTask.mutate(title);
  }

  function handleSummary(): void {
    onSend("/resumo — gere um resumo executivo desta sessão: pontos discutidos, decisões tomadas, próximos passos. Formato: lista com bullets.");
  }

  /* ── File attachment ── */
  const ALLOWED_TYPES = [
    "application/pdf",
    "text/plain", "text/csv", "text/markdown",
    "application/json",
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const MAX_SIZE_MB = 8;

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!e.target) return;
    (e.target as HTMLInputElement).value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(ts|tsx|js|jsx|py|java|kt|go|rs|cpp|c|cs|html|css|xml|yaml|yml|sh|sql|env)$/i)) {
      showToastMsg("Tipo de arquivo não suportado");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToastMsg(`Arquivo muito grande (máx ${MAX_SIZE_MB}MB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      setAttachedFile({ name: file.name, base64, type: file.type || "text/plain" });
      showToastMsg(`📎 ${file.name} anexado`);
    };
    reader.readAsDataURL(file);
  }

  async function handleSendWithFile(): Promise<void> {
    if (!attachedFile && !input.trim()) return;
    if (!attachedFile) { onSend(); return; }

    setAnalyzingFile(true);
    try {
      const prompt = input.trim() || "Analise este arquivo e me dê um resumo detalhado.";
      const result = await api.analyzeFile({ filename: attachedFile.name, content: attachedFile.base64, prompt });
      const parts: string[] = [`[Arquivo: ${attachedFile.name}]`];
      if (result.summary) parts.push(result.summary);
      if (result.insights?.length) parts.push("Insights:\n" + result.insights.map((ins: string) => `• ${ins}`).join("\n"));
      if (prompt !== "Analise este arquivo e me dê um resumo detalhado.") parts.push(`Pergunta: ${prompt}`);
      const combined = parts.join("\n\n");
      setAttachedFile(null);
      onInputChange("");
      onSend(combined);
    } catch {
      showToastMsg("Erro ao processar arquivo");
    } finally {
      setAnalyzingFile(false);
    }
  }

  const iconBtn = (active: boolean): CSSProperties => ({
    width: 34, height: 34, borderRadius: 7, flexShrink: 0,
    background: active ? `${color}18` : "rgba(255,255,255,0.025)",
    border: `1px solid ${active ? color + "55" : "rgba(255,255,255,0.08)"}`,
    color: active ? color : "rgba(255,255,255,0.36)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  });

  const dropStyle: CSSProperties = {
    position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
    background: "rgba(3,5,9,0.97)", border: `1px solid ${color}25`, borderRadius: 10,
    overflow: "hidden", zIndex: 50,
    boxShadow: `0 -8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}10`,
  };

  const hasConversation = messages.filter(m => m.role !== "system" && !m.loading).length >= 2;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
        {messages.map((m, i) => (
          <ChatMsg
            key={m.id ?? `msg-${i}`}
            msg={m}
            color={color}
            onAction={onSend}
            onSaveTask={m.role === "assistant" && m.content ? handleSaveAsTask : undefined}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Typing indicator */}
      {loading && activeTools.length === 0 && (
        <div style={{ padding: "6px 22px", display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${color}15`, borderRadius: 10 }}>
            <div style={{ display: "flex", gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.6, animation: `orionPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize: 9, fontFamily: "'Share Tech Mono', monospace", color: `${color}88`, letterSpacing: "0.08em", textTransform: "uppercase" }}>PROCESSANDO</span>
          </div>
        </div>
      )}

      {activeTools.length > 0 && (
        <div style={{ padding: "0 22px 4px" }}>
          <ToolIndicator tools={activeTools} color={color} />
        </div>
      )}

      {/* Quick commands + resumo */}
      <div style={{ padding: "0 22px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
        {QUICK_COMMANDS.map(cmd => (
          <button key={cmd} onClick={() => onSend(cmd)} style={{ padding: "4px 9px", fontSize: 9, fontFamily: "'Share Tech Mono', monospace", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap" }}>
            {cmd}
          </button>
        ))}
        {hasConversation && (
          <button onClick={handleSummary} style={{ padding: "4px 10px", fontSize: 9, fontFamily: "'Share Tech Mono', monospace", background: `${color}10`, border: `1px solid ${color}30`, color, borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 4 }}>
            ◈ RESUMO DA SESSÃO
          </button>
        )}
      </div>

      <SmartShortcuts onSend={onSend} color={color} />

      {/* Input */}
      <div style={{ padding: "10px 22px 18px", borderTop: `1px solid ${color}10`, flexShrink: 0 }}>
        <div style={{ position: "relative" }}>

          {/* @mention dropdown */}
          <AnimatePresence>
            {mentionOpen && filteredModules.length > 0 && (
              <motion.div key="mention" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={dropStyle}>
                <div style={{ padding: "6px 12px 4px", fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1.5 }}>MÓDULOS</div>
                {filteredModules.map((m, i) => (
                  <div key={m.id} onClick={() => pickMention(m)}
                    style={{ padding: "9px 14px", display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: i === mentionIdx ? `${color}10` : "transparent", borderLeft: i === mentionIdx ? `2px solid ${color}` : "2px solid transparent" }}>
                    <span style={{ color, fontSize: 12 }}>{m.icon}</span>
                    <span style={{ fontSize: 12, color: i === mentionIdx ? "#fff" : "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif" }}>{m.label}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* /slash dropdown */}
          <AnimatePresence>
            {slashOpen && filteredSlash.length > 0 && (
              <motion.div key="slash" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={dropStyle}>
                <div style={{ padding: "6px 12px 4px", fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1.5 }}>COMANDOS</div>
                {filteredSlash.map((s, i) => (
                  <div key={s.cmd} onClick={() => pickSlash(s)}
                    style={{ padding: "9px 14px", display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: i === slashIdx ? `${color}10` : "transparent", borderLeft: i === slashIdx ? `2px solid ${color}` : "2px solid transparent" }}>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color, minWidth: 80 }}>{s.cmd}</span>
                    <div>
                      <div style={{ fontSize: 12, color: i === slashIdx ? "#fff" : "rgba(255,255,255,0.7)", fontFamily: "'Rajdhani', sans-serif" }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontFamily: "'Share Tech Mono', monospace" }}>{s.detail}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* File preview chip */}
          <AnimatePresence>
            {attachedFile && (
              <motion.div
                key="file-chip"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "5px 10px", background: `${color}0D`, border: `1px solid ${color}30`, borderRadius: 8, maxWidth: "fit-content" }}
              >
                <Paperclip size={12} color={color} />
                <span style={{ fontSize: 11, color, fontFamily: "'Share Tech Mono', monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {attachedFile.name}
                </span>
                <button onClick={() => setAttachedFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 0, display: "flex", lineHeight: 1 }}>
                  <X size={12} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.ts,.tsx,.js,.jsx,.py,.java,.kt,.go,.rs,.cpp,.c,.cs,.html,.css,.xml,.yaml,.yml,.sh,.sql"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: 9, alignItems: "flex-end", background: "rgba(255,255,255,0.02)", border: `1px solid ${attachedFile ? color + "40" : color + "20"}`, borderRadius: 11, padding: "9px 12px", transition: "border-color 0.2s" }}>
            {/* Paperclip */}
            <button
              title="Anexar arquivo"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              style={{ ...iconBtn(Boolean(attachedFile)), flexShrink: 0, alignSelf: "flex-end", marginBottom: 1 }}
            >
              <Paperclip size={15} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder={attachedFile ? `Pergunta sobre ${attachedFile.name}...` : "Comando para O.R.I.O.N... (@ módulo, /comando)"}
              rows={1}
              style={{ flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 13, resize: "none", fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.5, minHeight: 22, maxHeight: 300, overflowY: "auto", outline: "none", overflowX: "hidden" }}
            />
            <button title={listening ? "Parar" : "Ditar"} onClick={toggleDictation} type="button" style={{ ...iconBtn(listening), alignSelf: "flex-end", marginBottom: 1 }}>
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button title={voiceReply ? "Desligar voz" : "Ligar voz"} onClick={() => { if (voiceReply) window.speechSynthesis?.cancel(); setVoiceReply(v => !v); }} type="button" style={{ ...iconBtn(voiceReply), alignSelf: "flex-end", marginBottom: 1 }}>
              {voiceReply ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => { void handleSendWithFile(); }}
              disabled={loading || analyzingFile || (!input.trim() && !attachedFile)}
              style={{ width: 34, height: 34, borderRadius: 7, flexShrink: 0, alignSelf: "flex-end", background: (loading || analyzingFile) ? "rgba(255,255,255,0.03)" : `linear-gradient(135deg, ${color}20, rgba(124,58,237,0.09))`, border: `1px solid ${(loading || analyzingFile) ? "rgba(255,255,255,0.07)" : color + "45"}`, color: (loading || analyzingFile) ? "rgba(255,255,255,0.15)" : color, cursor: (loading || analyzingFile) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: (loading || analyzingFile) ? "none" : `0 0 8px ${color}18` }}
            >
              {analyzingFile ? "◌" : loading ? "○" : <Send size={15} />}
            </button>
          </div>
        </div>
        <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.08)", marginTop: 5, textAlign: "center" }}>
          ENTER enviar · SHIFT+ENTER linha · @ módulo · / comando · 📎 arquivo
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div key="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", padding: "9px 18px", background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8, fontSize: 12, color, fontFamily: "'Share Tech Mono', monospace", zIndex: 1000, backdropFilter: "blur(6px)" }}>
            {showToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SpeechRecognitionResultLike { readonly transcript: string; }
interface SpeechRecognitionAlternativeListLike { readonly 0: SpeechRecognitionResultLike | undefined; }
interface SpeechRecognitionEventLike { readonly results: ArrayLike<SpeechRecognitionAlternativeListLike>; }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
