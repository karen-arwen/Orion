import { useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   SMART SHORTCUTS — atalhos contextuais que mudam com o módulo e hora.

   Mostra botões de ação rápida relevantes ao contexto atual.
   Ex: no Finance → "categorizar gastos", no Sleep → "registrar sono",
   de manhã → "morning brief", à noite → "registrar sono".
═══════════════════════════════════════════════════════════════════ */

interface Shortcut {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  color: string;
}

interface SmartShortcutsProps {
  activeModule?: string;
  onSend: (prompt: string) => void;
  color: string;
}

const TIME_SHORTCUTS: Record<string, Shortcut[]> = {
  morning: [
    { id: "brief", label: "Morning Brief", icon: "☀", prompt: "Gere meu briefing do dia com agenda, tarefas e prioridades.", color: "#F59E0B" },
    { id: "plan", label: "Planejar dia", icon: "▶", prompt: "Monte meu plano de acao para hoje baseado em energia, tarefas e agenda.", color: "#00D4FF" },
  ],
  afternoon: [
    { id: "check", label: "Check do dia", icon: "◈", prompt: "Como estou indo hoje? Analise progresso, foco e habitos.", color: "#00D4FF" },
    { id: "focus", label: "Iniciar foco", icon: "⚡", prompt: "Sugira uma sessao de foco de 25min baseada na minha tarefa mais prioritaria.", color: "#818CF8" },
  ],
  night: [
    { id: "review", label: "Resumo do dia", icon: "◉", prompt: "Faca um resumo do meu dia e prepare o amanha.", color: "#7C3AED" },
    { id: "sleep", label: "Registrar sono", icon: "☾", prompt: "Vou dormir agora. Registre meu sono e sugira melhorias.", color: "#6366F1" },
  ],
};

const MODULE_SHORTCUTS: Record<string, Shortcut[]> = {
  finance: [
    { id: "categorize", label: "Categorizar gastos", icon: "$", prompt: "Categorize minhas transacoes recentes sem categoria.", color: "#10B981" },
    { id: "budget", label: "Status orcamento", icon: "◎", prompt: "Como esta meu orcamento este mes? Estou dentro dos limites?", color: "#F59E0B" },
    { id: "subs", label: "Revisar assinaturas", icon: "↻", prompt: "Analise minhas assinaturas ativas. Tem alguma que nao estou usando?", color: "#EF4444" },
  ],
  habits: [
    { id: "streak", label: "Meus streaks", icon: "🔥", prompt: "Como estao meus streaks de habitos? Algum precisa de atencao?", color: "#F59E0B" },
    { id: "adjust", label: "Ajustar metas", icon: "⚙", prompt: "Analise meus habitos e sugira ajustes de frequencia baseado no meu padrao real.", color: "#7C3AED" },
  ],
  sleep: [
    { id: "log", label: "Registrar sono", icon: "☾", prompt: "Registre meu sono de ontem e me diga como estou dormindo.", color: "#6366F1" },
    { id: "tips", label: "Dicas de sono", icon: "✦", prompt: "Baseado nos meus dados de sono, me de 3 dicas praticas e personalizadas.", color: "#818CF8" },
  ],
  social: [
    { id: "nudges", label: "Quem falar", icon: "◇", prompt: "Quais contatos importantes eu nao falo ha muito tempo? Sugira mensagens.", color: "#7C3AED" },
    { id: "birthdays", label: "Aniversarios", icon: "★", prompt: "Tem algum aniversario proximo nos meus contatos?", color: "#F59E0B" },
  ],
  life: [
    { id: "next", label: "Proxima acao", icon: "▸", prompt: "Qual a proxima acao mais inteligente baseada na minha energia e prioridades?", color: "#00D4FF" },
    { id: "overdue", label: "Atrasadas", icon: "!", prompt: "Quais tarefas estao atrasadas? Me ajude a priorizar.", color: "#EF4444" },
  ],
  media: [
    { id: "recs", label: "Recomendacoes", icon: "♦", prompt: "Me recomende algo pra assistir ou jogar baseado no meu gosto.", color: "#F59E0B" },
    { id: "backlog", label: "Meu backlog", icon: "◻", prompt: "O que tenho pendente na minha lista de midia? Priorize por nota.", color: "#818CF8" },
  ],
  focus: [
    { id: "start25", label: "Pomodoro 25min", icon: "⏱", prompt: "Inicie uma sessao de foco de 25 minutos na minha tarefa mais prioritaria.", color: "#10B981" },
    { id: "deep90", label: "Deep Work 90min", icon: "◈", prompt: "Configure uma sessao de deep work de 90 minutos. Sugira o que focar.", color: "#00D4FF" },
  ],
  dev: [
    { id: "scan", label: "Scan workspace", icon: "⊡", prompt: "Escaneie meu workspace e me de um resumo do estado atual do codigo.", color: "#00D4FF" },
    { id: "debug", label: "Auto debug", icon: "⚠", prompt: "Rode um diagnostico no ultimo build/typecheck e sugira fixes.", color: "#EF4444" },
  ],
};

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "night";
}

export function SmartShortcuts({ activeModule, onSend, color }: SmartShortcutsProps): JSX.Element {
  const shortcuts = useMemo(() => {
    const time = getTimeOfDay();
    const timeShortcuts = TIME_SHORTCUTS[time] ?? [];
    const moduleShortcuts = activeModule ? (MODULE_SHORTCUTS[activeModule] ?? []) : [];

    // Module shortcuts take priority, then time-based
    const combined = [...moduleShortcuts, ...timeShortcuts];
    // Dedup by id and limit to 4
    const seen = new Set<string>();
    return combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    }).slice(0, 4);
  }, [activeModule]);

  if (shortcuts.length === 0) return <></>;

  return (
    <div style={{
      display: "flex",
      gap: 6,
      padding: "8px 16px",
      overflowX: "auto",
      scrollbarWidth: "none",
      flexShrink: 0,
    }}>
      {shortcuts.map((s) => (
        <button
          key={s.id}
          onClick={() => onSend(s.prompt)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 20,
            border: `1px solid ${s.color}30`,
            background: `${s.color}08`,
            color: s.color,
            fontSize: 11,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${s.color}18`;
            e.currentTarget.style.borderColor = `${s.color}50`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${s.color}08`;
            e.currentTarget.style.borderColor = `${s.color}30`;
          }}
        >
          <span style={{ fontSize: 13 }}>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
