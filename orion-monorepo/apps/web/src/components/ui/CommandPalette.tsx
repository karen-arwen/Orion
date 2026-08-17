import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

const CYAN = "#00D4FF";
const DIM  = "rgba(255,255,255,0.3)";

const MODULE_ROUTES: Record<string, string> = {
  life:       "/m/life",
  finance:    "/m/finance",
  comms:      "/m/comms",
  knowledge:  "/m/know",
  social:     "/m/social",
  media:      "/m/media",
  travel:     "/m/travel",
  chef:       "/m/chef",
  health:     "/m/health",
  habits:     "/m/habits",
  focus:      "/m/focus",
  career:     "/m/career",
  shop:       "/m/shop",
  security:   "/m/security",
  creative:   "/m/creative",
  language:   "/m/language",
  sleep:      "/m/sleep",
  news:       "/m/news",
  gaming:     "/m/gaming",
  mindset:    "/m/mindset",
  dev:        "/m/dev",
  workflows:  "/m/workflows",
  agenda:     "/m/agenda",
  docs:       "/m/docs",
};

const MODULE_LABELS: Record<string, string> = {
  life: "Life OS", finance: "Finanças", comms: "COMMS", knowledge: "Conhecimento",
  social: "Social", media: "Mídia", travel: "Viagem", diary: "Diário",
  chef: "Chef", health: "Saúde", habits: "Hábitos", focus: "Foco",
  career: "Carreira", shop: "Compras", security: "Segurança", creative: "Criação",
  language: "Idiomas", sleep: "Sono", news: "Notícias", gaming: "Gaming",
  mindset: "Mindset", dev: "Dev", workflows: "Workflows", timeline: "Timeline",
};

const NAV_COMMANDS = Object.entries(MODULE_ROUTES).map(([mod, path]) => ({
  type: "nav" as const,
  id: `nav-${mod}`,
  title: MODULE_LABELS[mod] ?? mod,
  subtitle: `Abrir módulo ${mod}`,
  module: mod,
  icon: "▸",
  path,
}));

interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  icon: string;
  score?: number;
  path?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element | null {
  const [q, setQ]               = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);
  const listRef                 = useRef<HTMLDivElement>(null);
  const navigate                = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", q],
    queryFn: () => api.search.global(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });

  const filtered = q.trim().length < 2
    ? NAV_COMMANDS.filter(c => !q || c.title.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
    : (data?.results ?? []).map(r => ({ ...r, path: MODULE_ROUTES[r.module] }));

  // Reset on open
  useEffect(() => {
    if (open) {
      setQ("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const pickItem = useCallback((item: SearchResultItem): void => {
    if (item.path) navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  const handleKey = useCallback((e: KeyboardEvent): void => {
    if (!open) return;
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selected];
      if (item) pickItem(item);
    }
  }, [open, filtered, selected, pickItem, onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => { setSelected(0); }, [q]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cp-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(3,5,9,0.88)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: "12vh",
        }}>

        <motion.div
          key="cp-panel"
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "min(700px, 94vw)",
            background: "rgba(3,5,9,0.98)",
            border: `1px solid ${CYAN}30`,
            borderRadius: 14,
            boxShadow: `0 0 0 1px rgba(0,212,255,0.06), 0 0 40px ${CYAN}12, 0 32px 80px rgba(0,0,0,0.7)`,
            overflow: "hidden",
          }}>

          {/* Search input */}
          <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid rgba(255,255,255,0.05)`, gap: 14 }}>
            <span style={{ fontSize: 18, color: CYAN, opacity: 0.6, flexShrink: 0 }}>⌕</span>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar em todo o ORION... (tarefas, notas, transações, contatos)"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#fff", fontSize: 15, fontFamily: "'Rajdhani', sans-serif",
                letterSpacing: 0.3,
              }}
            />
            {isFetching && (
              <span style={{ fontSize: 11, color: CYAN, fontFamily: "'Share Tech Mono', monospace" }}>◌</span>
            )}
            <kbd style={{
              padding: "3px 7px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
              fontSize: 10, color: DIM, fontFamily: "'Share Tech Mono', monospace", flexShrink: 0,
            }}>ESC</kbd>
          </div>

          {/* Category label */}
          {q.trim().length < 2 && (
            <div style={{ padding: "10px 20px 4px", fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1.5 }}>
              MÓDULOS — NAVEGAÇÃO RÁPIDA
            </div>
          )}
          {q.trim().length >= 2 && !isFetching && (
            <div style={{ padding: "10px 20px 4px", fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1.5 }}>
              {filtered.length} RESULTADO{filtered.length !== 1 ? "S" : ""}
            </div>
          )}

          {/* Results list */}
          <div ref={listRef} style={{ maxHeight: "52vh", overflowY: "auto", padding: "4px 0 8px" }}>
            {filtered.length === 0 && q.trim().length >= 2 && !isFetching && (
              <div style={{ padding: "24px 20px", textAlign: "center", color: DIM, fontSize: 13, fontFamily: "'Share Tech Mono', monospace" }}>
                Nada encontrado para <span style={{ color: CYAN }}>"{q}"</span>
              </div>
            )}
            {filtered.map((item, i) => (
              <ResultRow
                key={item.id}
                item={item}
                idx={i}
                selected={selected === i}
                onPick={pickItem}
                onHover={setSelected}
              />
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: "8px 20px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", gap: 18, alignItems: "center",
            fontSize: 9, color: "rgba(255,255,255,0.18)",
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            <span>↑↓ NAVEGAR</span>
            <span>↵ ABRIR</span>
            <span>ESC FECHAR</span>
            <span style={{ marginLeft: "auto", color: `${CYAN}44`, letterSpacing: 2 }}>O.R.I.O.N SEARCH</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const TYPE_COLOR: Record<string, string> = {
  task:        "#00D4FF",
  note:        "#7C3AED",
  transaction: "#F59E0B",
  contact:     "#10B981",
  goal:        "#EC4899",
  media:       "#F97316",
  travel:      "#14B8A6",
  journal:     "#8B5CF6",
  nav:         "rgba(255,255,255,0.35)",
};

function ResultRow({ item, idx, selected, onPick, onHover }: {
  item: SearchResultItem;
  idx: number;
  selected: boolean;
  onPick: (item: SearchResultItem) => void;
  onHover: (idx: number) => void;
}): JSX.Element {
  const c = TYPE_COLOR[item.type] ?? CYAN;
  return (
    <div
      data-idx={idx}
      onClick={() => onPick(item)}
      onMouseEnter={() => onHover(idx)}
      style={{
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 14,
        cursor: "pointer",
        background: selected ? `${CYAN}07` : "transparent",
        borderLeft: selected ? `2px solid ${CYAN}` : "2px solid transparent",
        transition: "background 0.08s, border-color 0.08s",
      }}>
      <span style={{ fontSize: 14, color: c, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: selected ? "#fff" : "rgba(255,255,255,0.78)",
          fontFamily: "'Rajdhani', sans-serif",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.32)",
            fontFamily: "'Share Tech Mono', monospace",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            marginTop: 1,
          }}>
            {item.subtitle}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 8, color: c,
        fontFamily: "'Share Tech Mono', monospace",
        background: `${c}10`, padding: "3px 7px", borderRadius: 3,
        flexShrink: 0, letterSpacing: 1,
      }}>
        {item.module.toUpperCase()}
      </span>
      {selected && (
        <span style={{ fontSize: 11, color: `${CYAN}80`, flexShrink: 0 }}>↵</span>
      )}
    </div>
  );
}