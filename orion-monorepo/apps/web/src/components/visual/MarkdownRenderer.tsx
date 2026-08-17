import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CSSProperties, ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════
   MARKDOWN RENDERER — HUD-style para mensagens do ORION.

   Renderiza bold, italic, listas, code blocks, links e tabelas
   com a estetica sci-fi do projeto.
═══════════════════════════════════════════════════════════════════ */

interface MarkdownRendererProps {
  content: string;
  color: string;
}

interface NodeProps { children?: ReactNode }
interface CodeProps { children?: ReactNode; className?: string }
interface LinkProps { children?: ReactNode; href?: string }

const mono: CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace",
};

export function MarkdownRenderer({ content, color }: MarkdownRendererProps): JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }: NodeProps) => (
          <p style={{ margin: "4px 0", lineHeight: 1.7 }}>{children}</p>
        ),

        strong: ({ children }: NodeProps) => (
          <strong style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>{children}</strong>
        ),

        em: ({ children }: NodeProps) => (
          <em style={{ color: `${color}CC`, fontStyle: "italic" }}>{children}</em>
        ),

        code: ({ children, className }: CodeProps) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code
                style={{
                  ...mono,
                  display: "block",
                  padding: "12px 14px",
                  margin: "8px 0",
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${color}20`,
                  borderRadius: 8,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.78)",
                  overflowX: "auto",
                  lineHeight: 1.6,
                  whiteSpace: "pre",
                }}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              style={{
                ...mono,
                padding: "1px 6px",
                background: `${color}12`,
                border: `1px solid ${color}18`,
                borderRadius: 4,
                fontSize: 11,
                color,
              }}
            >
              {children}
            </code>
          );
        },

        pre: ({ children }: NodeProps) => (
          <pre style={{ margin: 0, overflow: "visible" }}>{children}</pre>
        ),

        a: ({ href, children }: LinkProps) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color,
              textDecoration: "none",
              borderBottom: `1px solid ${color}44`,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = color; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = `${color}44`; }}
          >
            {children}
          </a>
        ),

        ul: ({ children }: NodeProps) => (
          <ul style={{ margin: "6px 0", paddingLeft: 18, listStyle: "none" }}>{children}</ul>
        ),
        ol: ({ children }: NodeProps) => (
          <ol style={{ margin: "6px 0", paddingLeft: 18 }}>{children}</ol>
        ),
        li: ({ children }: NodeProps) => (
          <li style={{ margin: "3px 0", position: "relative", paddingLeft: 6 }}>
            <span style={{ position: "absolute", left: -12, color: `${color}66`, fontSize: 8, top: 5 }}>{"▸"}</span>
            {children}
          </li>
        ),

        h1: ({ children }: NodeProps) => (
          <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: "10px 0 6px", fontFamily: "'Rajdhani', sans-serif" }}>{children}</div>
        ),
        h2: ({ children }: NodeProps) => (
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: "8px 0 4px", fontFamily: "'Rajdhani', sans-serif" }}>{children}</div>
        ),
        h3: ({ children }: NodeProps) => (
          <div style={{ fontSize: 13, fontWeight: 600, color, margin: "6px 0 3px", fontFamily: "'Rajdhani', sans-serif" }}>{children}</div>
        ),

        hr: () => (
          <div style={{ height: 1, background: `${color}18`, margin: "10px 0" }} />
        ),

        blockquote: ({ children }: NodeProps) => (
          <div style={{
            borderLeft: `2px solid ${color}44`,
            paddingLeft: 12,
            margin: "6px 0",
            color: "rgba(255,255,255,0.55)",
            fontStyle: "italic",
          }}>
            {children}
          </div>
        ),

        table: ({ children }: NodeProps) => (
          <div style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ ...mono, fontSize: 10, borderCollapse: "collapse", width: "100%", border: `1px solid ${color}18` }}>
              {children}
            </table>
          </div>
        ),
        th: ({ children }: NodeProps) => (
          <th style={{
            padding: "6px 10px",
            background: `${color}10`,
            borderBottom: `1px solid ${color}25`,
            textAlign: "left",
            color,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            {children}
          </th>
        ),
        td: ({ children }: NodeProps) => (
          <td style={{
            padding: "5px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.65)",
          }}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
