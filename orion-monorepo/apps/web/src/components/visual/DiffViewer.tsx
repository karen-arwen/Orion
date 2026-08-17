/* ═══════════════════════════════════════════════════════════════════
   DIFF VIEWER — renderiza diffs coloridos estilo git.

   Aceita texto em formato search/replace ou unified diff.
   Verde = adicionado, Vermelho = removido.
═══════════════════════════════════════════════════════════════════ */

interface DiffViewerProps {
  content: string;
  maxLines?: number;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  text: string;
}

function parseDiff(raw: string): DiffLine[] {
  const lines = raw.split("\n");
  const result: DiffLine[] = [];

  let inSearch = false;
  let inReplace = false;

  for (const line of lines) {
    // Unified diff format
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
      result.push({ type: "header", text: line });
      continue;
    }
    if (line.startsWith("+")) {
      result.push({ type: "add", text: line.slice(1) });
      continue;
    }
    if (line.startsWith("-")) {
      result.push({ type: "remove", text: line.slice(1) });
      continue;
    }

    // Search/Replace format (ORION's workspace patches)
    if (line.includes("<<<< SEARCH")) { inSearch = true; continue; }
    if (line.includes("====")) { inSearch = false; inReplace = true; continue; }
    if (line.includes(">>>> REPLACE")) { inReplace = false; continue; }

    if (inSearch) {
      result.push({ type: "remove", text: line });
    } else if (inReplace) {
      result.push({ type: "add", text: line });
    } else {
      result.push({ type: "context", text: line });
    }
  }

  return result;
}

const lineColors = {
  add: { bg: "rgba(16, 185, 129, 0.1)", border: "#10B981", color: "#6EE7B7" },
  remove: { bg: "rgba(239, 68, 68, 0.1)", border: "#EF4444", color: "#FCA5A5" },
  context: { bg: "transparent", border: "transparent", color: "rgba(255,255,255,0.4)" },
  header: { bg: "rgba(0, 212, 255, 0.05)", border: "#00D4FF", color: "#00D4FF" },
};

export function DiffViewer({ content, maxLines = 40 }: DiffViewerProps): JSX.Element {
  const lines = parseDiff(content).slice(0, maxLines);
  const addCount = lines.filter((l) => l.type === "add").length;
  const removeCount = lines.filter((l) => l.type === "remove").length;

  return (
    <div style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 11,
      borderRadius: 6,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Stats bar */}
      <div style={{
        display: "flex",
        gap: 12,
        padding: "6px 10px",
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        fontSize: 9,
      }}>
        <span style={{ color: "#10B981" }}>+{addCount}</span>
        <span style={{ color: "#EF4444" }}>-{removeCount}</span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>{lines.length} linhas</span>
      </div>

      {/* Diff lines */}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {lines.map((line, i) => {
          const style = lineColors[line.type];
          return (
            <div
              key={i}
              style={{
                padding: "2px 10px",
                background: style.bg,
                borderLeft: `2px solid ${style.border}`,
                color: style.color,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
            >
              <span style={{ opacity: 0.4, marginRight: 8, userSelect: "none" }}>
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </span>
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
