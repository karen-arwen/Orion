import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrionMode } from "@orion/types";
import { api } from "../../lib/api.js";

export interface CommandItem {
  id: string;
  label: string;
  detail: string;
  group: "modulo" | "acao" | "modo" | "sistema";
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  color: string;
  items: CommandItem[];
  onClose: () => void;
}

const GROUP_LABEL: Record<CommandItem["group"], string> = {
  modulo:  "MÓDULO",
  acao:    "AÇÃO",
  modo:    "MODO",
  sistema: "SISTEMA",
};

const TYPE_COLOR: Record<string, string> = {
  task:        "#00D4FF",
  note:        "#7C3AED",
  transaction: "#F59E0B",
  contact:     "#10B981",
  goal:        "#EC4899",
  media:       "#F97316",
  travel:      "#14B8A6",
  journal:     "#8B5CF6",
};

// A unified row type so we can flatten local commands + remote results into one list
type AnyItem =
  | { kind: "cmd"; idx: number; item: CommandItem }
  | { kind: "result"; idx: number; result: { type: string; id: string; title: string; subtitle?: string; module: string; icon: string }; run: () => void };

export function CommandPalette({ open, color, items, onClose }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery]   = useState("");
  const [active, setActive] = useState(0);
  const inputRef            = useRef<HTMLInputElement>(null);
  const listRef             = useRef<HTMLDivElement>(null);

  // Remote search (≥2 chars)
  const { data: searchData, isFetching } = useQuery({
    queryKey: ["cmd-search", query],
    queryFn: () => api.search.global(query),
    enabled: open && query.trim().length >= 2,
    staleTime: 8_000,
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  // Filtered local commands
  const filteredCmds = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => `${it.label} ${it.detail} ${it.group}`.toLowerCase().includes(q));
  }, [items, query]);

  // Build unified flat list
  const flat = useMemo<AnyItem[]>(() => {
    const out: AnyItem[] = [];
    filteredCmds.forEach((item, i) => out.push({ kind: "cmd", idx: i, item }));
    (searchData?.results ?? []).forEach((r, i) => out.push({
      kind: "result",
      idx: filteredCmds.length + i,
      result: r,
      run: () => { /* navigation handled below */ },
    }));
    return out;
  }, [filteredCmds, searchData]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(v => Math.min(v + 1, flat.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive(v => Math.max(v - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const row = flat[active];
        if (!row) return;
        if (row.kind === "cmd") { row.item.run(); onClose(); }
        else { navigateToResult(row.result.module); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, active, onClose]);

  // Scroll active into view
  useEffect(() => {
    listRef.current?.querySelector(`[data-flat="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  function navigateToResult(module: string): void {
    const MODULE_ROUTE: Record<string, string> = {
      comms: "/m/comms", calendar: "/m/agenda", life: "/m/life", know: "/m/know",
      career: "/m/career", finance: "/m/finance", docs: "/m/docs", health: "/m/health",
      focus: "/m/focus", habit: "/m/habits", sleep: "/m/sleep", creative: "/m/creative",
      media: "/m/media", gaming: "/m/gaming", chef: "/m/chef", travel: "/m/travel",
      news: "/m/news", social: "/m/social", shop: "/m/shop", lang: "/m/language",
      whatif: "/m/whatif", mindset: "/m/mindset", sec: "/m/security", dev: "/m/dev",
      quest: "/m/quest",
    };
    const route = MODULE_ROUTE[module] ?? `/${module}`;
    window.history.pushState({}, "", route);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  // Group local cmds for display
  const groups = Array.from(new Set(filteredCmds.map(c => c.group)));

  let flatIdx = 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(3,5,9,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(640px, 90vw)",
          background: "rgba(3,5,9,0.97)",
          border: `1px solid ${color}30`,
          borderRadius: 14,
          boxShadow: `0 0 60px ${color}18, 0 24px 64px rgba(0,0,0,0.6)`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Search bar */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${color}18`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color, fontSize: 14, flexShrink: 0 }}>{">"}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="BUSCAR MÓDULOS, AÇÕES OU CONTEÚDO..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "rgba(255,255,255,0.85)", fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13, letterSpacing: "0.05em",
            }}
          />
          {isFetching && <span style={{ fontSize: 10, color, fontFamily: "'Share Tech Mono', monospace", opacity: 0.6 }}>◌</span>}
          <kbd style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {/* Local commands by group */}
          {groups.map(g => {
            const grpItems = filteredCmds.filter(c => c.group === g);
            if (!grpItems.length) return null;
            return (
              <div key={g}>
                <div style={{ padding: "8px 18px 4px", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.12em" }}>
                  {GROUP_LABEL[g]}
                </div>
                {grpItems.map(item => {
                  const myIdx = flatIdx++;
                  const isActive = myIdx === active;
                  return (
                    <div
                      key={item.id}
                      data-flat={myIdx}
                      onClick={() => { item.run(); onClose(); }}
                      onMouseEnter={() => setActive(myIdx)}
                      style={{
                        padding: "10px 18px",
                        display: "flex", alignItems: "center", gap: 12,
                        background: isActive ? `${color}12` : "transparent",
                        borderLeft: `2px solid ${isActive ? color : "transparent"}`,
                        cursor: "pointer",
                        transition: "all 0.1s ease",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: isActive ? color : "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>{item.label}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Rajdhani', sans-serif", marginTop: 1 }}>{item.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Remote search results */}
          {(searchData?.results ?? []).length > 0 && (
            <div>
              <div style={{ padding: "8px 18px 4px", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.12em" }}>
                CONTEÚDO
              </div>
              {(searchData?.results ?? []).map(r => {
                const myIdx = flatIdx++;
                const isActive = myIdx === active;
                const rc = TYPE_COLOR[r.type] ?? color;
                return (
                  <div
                    key={`${r.type}-${r.id}`}
                    data-flat={myIdx}
                    onClick={() => { navigateToResult(r.module); onClose(); }}
                    onMouseEnter={() => setActive(myIdx)}
                    style={{
                      padding: "10px 18px",
                      display: "flex", alignItems: "center", gap: 12,
                      background: isActive ? `${color}12` : "transparent",
                      borderLeft: `2px solid ${isActive ? color : "transparent"}`,
                      cursor: "pointer",
                      transition: "all 0.1s ease",
                    }}
                  >
                    <span style={{ fontSize: 14, color: rc, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: isActive ? color : "rgba(255,255,255,0.75)", letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                      {r.subtitle && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Rajdhani', sans-serif", marginTop: 1 }}>{r.subtitle}</div>}
                    </div>
                    <span style={{ fontSize: 8, color: rc, background: `${rc}15`, padding: "2px 6px", borderRadius: 4, fontFamily: "'Share Tech Mono', monospace", flexShrink: 0 }}>
                      {r.type.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {flat.length === 0 && !isFetching && (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
              {query.trim().length < 2 && query.length > 0
                ? "DICA: DIGITE 2+ LETRAS PARA BUSCAR CONTEÚDO"
                : "NENHUM RESULTADO"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 18px", borderTop: `1px solid rgba(255,255,255,0.04)`, display: "flex", gap: 16, alignItems: "center" }}>
          {(["↑↓ NAVEGAR", "↵ EXECUTAR", "ESC FECHAR"] as const).map(hint => (
            <span key={hint} style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.08em" }}>{hint}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Retorna label legível para um OrionMode — usado pelo OrionLayout */
export function modeCommandLabel(mode: OrionMode): string {
  const labels: Record<OrionMode, string> = {
    SILENCIOSO: "SILENCIOSO",
    NORMAL: "NORMAL",
    STARK: "MODO STARK",
  };
  return labels[mode] ?? mode;
}
