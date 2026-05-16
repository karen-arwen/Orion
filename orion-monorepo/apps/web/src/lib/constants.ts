import type { OrionModule, ModuleCategoryMeta } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   Constantes do frontend.
   Idealmente o backend é fonte da verdade — espelhamos aqui pra render
   imediato sem round-trip no boot.
═══════════════════════════════════════════════════════════════════ */

export const ALL_MODULES: readonly OrionModule[] = [
  { id: "comms",    icon: "◈", label: "COMMS",         sub: "Email · WhatsApp · Slack",          cat: "core",     hasReal: true  },
  { id: "calendar", icon: "⬡", label: "AGENDA",        sub: "Eventos · Conflitos · Focus",       cat: "core",     hasReal: true  },
  { id: "life",     icon: "◎", label: "LIFE OS",       sub: "Tarefas · Energia · Planner",       cat: "core",     hasReal: false },
  { id: "know",     icon: "◉", label: "CONHECIMENTO",  sub: "Tutor · Expert · Dev",              cat: "core",     hasReal: false },
  { id: "career",   icon: "↑", label: "CARREIRA",      sub: "Coach · Portfólio · Vagas",         cat: "growth",   hasReal: false },
  { id: "finance",  icon: "◆", label: "CFO PESSOAL",   sub: "Gastos · Metas · Alertas",          cat: "growth",   hasReal: false },
  { id: "health",   icon: "♡", label: "SAÚDE",         sub: "Sono · Energia · Pausas",           cat: "wellness", hasReal: true  },
  { id: "focus",    icon: "◐", label: "FOCO",          sub: "Pomodoro · Flow · Bloqueio",        cat: "wellness", hasReal: true  },
  { id: "habit",    icon: "✓", label: "HÁBITOS",       sub: "Streak · Tracking · Coach",         cat: "wellness", hasReal: true  },
  { id: "sleep",    icon: "☽", label: "SLEEP",         sub: "Rotina · Qualidade · Relax",        cat: "wellness", hasReal: true  },
  { id: "creative", icon: "✦", label: "CRIAÇÃO",       sub: "Ideias · Nomes · Conteúdo",         cat: "create",   hasReal: true  },
  { id: "entert",   icon: "▷", label: "MÍDIA",         sub: "Filmes · Animes · Séries",          cat: "create",   hasReal: false },
  { id: "gaming",   icon: "▣", label: "GAMING",        sub: "Deals · Builds · Companion",        cat: "create",   hasReal: true  },
  { id: "chef",     icon: "◍", label: "CHEF",          sub: "Receitas · Nutrição · Compras",     cat: "create",   hasReal: false },
  { id: "travel",   icon: "◁", label: "TRAVEL",        sub: "Passagens · Deals · Roteiros",      cat: "explore",  hasReal: false },
  { id: "news",     icon: "◌", label: "RADAR",         sub: "Notícias · Trends · Oportunidades", cat: "explore",  hasReal: false },
  { id: "social",   icon: "◫", label: "SOCIAL",        sub: "Networking · Conexões · CRM",       cat: "explore",  hasReal: false },
  { id: "shop",     icon: "◬", label: "COMPRAS",       sub: "Price Watch · Deals · Cupons",      cat: "explore",  hasReal: false },
  { id: "sec",      icon: "⬡", label: "SEGURANÇA",     sub: "Senhas · Privacidade · Guard",      cat: "system",   hasReal: false },
  { id: "auto",     icon: "⚙", label: "AUTOMAÇÕES",    sub: "Triggers · Rotinas · Flows",        cat: "system",   hasReal: false },
  { id: "docs",     icon: "◧", label: "DOCUMENTOS",    sub: "Análise · Contratos · Drive",       cat: "system",   hasReal: true  },
  { id: "iot",      icon: "◩", label: "CASA / IOT",    sub: "Luzes · Temp · Dispositivos",       cat: "system",   hasReal: false },
  { id: "whatif",   icon: "◮", label: "WHAT-IF",       sub: "Cenários · Simulações · Planos",    cat: "system",   hasReal: false },
  { id: "lang",     icon: "◷", label: "IDIOMAS",       sub: "Inglês · Prática · Imersão",        cat: "growth",   hasReal: false },
  { id: "mindset",  icon: "◶", label: "MINDSET",       sub: "Motivação · Clareza · Metas",       cat: "wellness", hasReal: false },
  { id: "plugin",   icon: "◴", label: "PLUGINS",       sub: "API · Extensões · Ecosystem",       cat: "system",   hasReal: false },
];

export const MODULE_CATS: Record<string, ModuleCategoryMeta> = {
  core:     { label: "CORE",        color: "#00D4FF" },
  growth:   { label: "CRESCIMENTO", color: "#F59E0B" },
  wellness: { label: "BEM-ESTAR",   color: "#10B981" },
  create:   { label: "CRIAÇÃO",     color: "#7C3AED" },
  explore:  { label: "EXPLORAR",    color: "#EC4899" },
  system:   { label: "SISTEMA",     color: "#64748B" },
};

export const QUICK_COMMANDS: readonly string[] = [
  "Verifica meu email urgente",
  "O que tenho na agenda hoje?",
  "Plano de estudos para hoje",
  "Ideias de conteúdo pra mim",
  "Me treina pra entrevista técnica",
  "O que assistir hoje?",
];

export const MODES = ["SILENCIOSO", "NORMAL", "STARK"] as const;
