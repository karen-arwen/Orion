import { useEffect, useState } from "react";
import type { ActiveTool } from "../../stores/chat.store.js";

/* ═══════════════════════════════════════════════════════════════════
   ToolIndicator — indicador HUD de ferramentas ativas.

   Aparece no chat quando o ORION está executando uma tool em tempo
   real. Design sci-fi: nome da tool com animação de scan.

   Estados:
   - running: pulsando com cor primária
   - done: verde por 2s antes de sumir
   - error: vermelho por 2s antes de sumir
═══════════════════════════════════════════════════════════════════ */

const TOOL_LABELS: Record<string, string> = {
  gmail_list: "GMAIL · LISTANDO",
  gmail_read: "GMAIL · LENDO",
  gmail_send: "GMAIL · ENVIANDO",
  gmail_draft: "GMAIL · RASCUNHO",
  gmail_reply: "GMAIL · RESPONDENDO",
  calendar_list: "AGENDA · LISTANDO",
  calendar_create: "AGENDA · CRIANDO EVENTO",
  drive_search: "DRIVE · BUSCANDO",
  drive_read: "DRIVE · LENDO",
  web_search: "WEB · BUSCANDO",
  trends_movies: "TMDB · FILMES",
  trends_series: "TMDB · SERIES",
  trends_games: "RAWG · JOGOS",
  game_search: "RAWG · BUSCANDO",
  slack_history: "SLACK · HISTORICO",
  slack_post_message: "SLACK · ENVIANDO",
  spotify_search: "SPOTIFY · BUSCANDO",
  todoist_list_tasks: "TODOIST · TAREFAS",
  todoist_create_task: "TODOIST · CRIANDO",
  linear_list_issues: "LINEAR · ISSUES",
  linear_create_issue: "LINEAR · CRIANDO",
  orion_action: "ORION · AGINDO",
  workspace_scan: "WORKSPACE · SCAN",
  workspace_read_file: "WORKSPACE · LENDO",
  workspace_prepare_file: "WORKSPACE · PREPARANDO",
  workspace_prepare_patch: "WORKSPACE · PATCH",
  workspace_prepare_command: "WORKSPACE · COMANDO",
  workspace_context_map: "WORKSPACE · MAPEANDO",
};

function getLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.toUpperCase().replace(/_/g, " · ");
}

interface ToolIndicatorProps {
  tools: ActiveTool[];
  color: string;
}

export function ToolIndicator({ tools, color }: ToolIndicatorProps): JSX.Element | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const allDone = tools.every((t) => t.status !== "running");
    if (allDone && tools.length > 0) {
      const timer = setTimeout(() => setVisible(false), 1800);
      return () => clearTimeout(timer);
    }
    setVisible(true);
    return undefined;
  }, [tools]);

  if (!visible || tools.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      marginBottom: "8px",
      paddingLeft: "8px",
    }}>
      {tools.map((tool) => (
        <ToolChip key={tool.name} tool={tool} color={color} />
      ))}
    </div>
  );
}

function ToolChip({ tool, color }: { tool: ActiveTool; color: string }): JSX.Element {
  const isRunning = tool.status === "running";
  const isDone = tool.status === "done";
  const isError = tool.status === "error";

  const chipColor = isError ? "#EF4444" : isDone ? "#10B981" : color;

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "3px 8px",
      borderRadius: "2px",
      border: `1px solid ${chipColor}40`,
      background: `${chipColor}0a`,
      width: "fit-content",
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: "10px",
      letterSpacing: "0.08em",
      color: chipColor,
      opacity: isDone || isError ? 0.6 : 1,
      transition: "opacity 0.4s ease",
    }}>
      {/* Ícone de status */}
      {isRunning && <ScanDot color={chipColor} />}
      {isDone && <span style={{ fontSize: "9px" }}>✓</span>}
      {isError && <span style={{ fontSize: "9px" }}>✗</span>}

      {getLabel(tool.name)}
    </div>
  );
}

function ScanDot({ color }: { color: string }): JSX.Element {
  return (
    <span style={{
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: color,
      display: "inline-block",
      animation: "orion-pulse 1s ease-in-out infinite",
    }} />
  );
}
