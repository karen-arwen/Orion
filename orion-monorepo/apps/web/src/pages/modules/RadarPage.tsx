import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useRemoveNews,
  useSaveNews,
  useSavedNews,
  useSearchNews,
} from "../../hooks/modules/useNews.js";

const PRIMARY = "#EC4899";

type Freshness = "pd" | "pw" | "pm";

const FRESHNESS: Array<{ id: Freshness; label: string }> = [
  { id: "pd", label: "24H" },
  { id: "pw", label: "SEMANA" },
  { id: "pm", label: "MÊS" },
];

const QUICK_TOPICS = [
  "tecnologia",
  "vagas dev brasil",
  "lançamentos de jogos",
  "anime recente",
  "design tendências",
  "ia generativa",
];

export function RadarPage(): JSX.Element {
  const [query, setQuery] = useState("");
  const [freshness, setFreshness] = useState<Freshness>("pw");
  const [tab, setTab] = useState<"search" | "saved">("search");

  const search = useSearchNews();
  const save = useSaveNews();
  const remove = useRemoveNews();
  const { data: saved } = useSavedNews();

  const handleSearch = (q?: string): void => {
    const term = q ?? query.trim();
    if (!term) return;
    setQuery(term);
    search.mutate({ query: term, freshness });
  };

  return (
    <ModuleShell icon="◌" label="RADAR" sub="Notícias · Trends · Oportunidades" color={PRIMARY}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {(["search", "saved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="hud-label"
              style={{
                padding: "8px 14px",
                fontSize: 10,
                background: tab === t ? `${PRIMARY}20` : "transparent",
                border: `1px solid ${tab === t ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                color: tab === t ? PRIMARY : "rgba(255,255,255,0.4)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {t === "search" ? "◌ BUSCAR" : `📑 SALVOS · ${saved?.length ?? 0}`}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <>
            <div
              style={{
                padding: 14,
                marginBottom: 16,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${PRIMARY}30`,
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="O que tá rolando?"
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "'Rajdhani', sans-serif",
                  }}
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={search.isPending}
                  className="hud-label"
                  style={{
                    padding: "8px 14px",
                    fontSize: 10,
                    background: `${PRIMARY}25`,
                    border: `1px solid ${PRIMARY}`,
                    color: PRIMARY,
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {search.isPending ? "BUSCANDO…" : "▶"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="hud-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                  RECÊNCIA:
                </span>
                {FRESHNESS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFreshness(f.id)}
                    className="hud-label"
                    style={{
                      padding: "3px 9px",
                      fontSize: 9,
                      background: freshness === f.id ? `${PRIMARY}25` : "transparent",
                      border: `1px solid ${PRIMARY}40`,
                      color: freshness === f.id ? PRIMARY : "rgba(255,255,255,0.4)",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {QUICK_TOPICS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSearch(q)}
                    style={{
                      padding: "4px 9px",
                      fontSize: 9,
                      fontFamily: "'Share Tech Mono', monospace",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.4)",
                      borderRadius: 20,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {search.data && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {search.data.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${PRIMARY}20`,
                      borderLeft: `2px solid ${PRIMARY}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.9)",
                          fontWeight: 600,
                          textDecoration: "none",
                          flex: 1,
                        }}
                      >
                        {r.title}
                      </a>
                      {r.age && (
                        <span
                          className="hud-label"
                          style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}
                        >
                          {r.age}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6, lineHeight: 1.5 }}>
                      {r.description.slice(0, 240)}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hud-label"
                        style={{
                          padding: "3px 9px",
                          fontSize: 9,
                          background: `${PRIMARY}15`,
                          border: `1px solid ${PRIMARY}40`,
                          color: PRIMARY,
                          borderRadius: 4,
                          cursor: "pointer",
                          textDecoration: "none",
                        }}
                      >
                        ABRIR
                      </a>
                      <button
                        onClick={() =>
                          save.mutate({
                            title: r.title,
                            url: r.url,
                            summary: r.description,
                            category: query.slice(0, 40),
                          })
                        }
                        className="hud-label"
                        style={{
                          padding: "3px 9px",
                          fontSize: 9,
                          background: "rgba(16,185,129,0.15)",
                          border: "1px solid rgba(16,185,129,0.4)",
                          color: "#10B981",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        ★ SALVAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "saved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(saved ?? []).length === 0 && (
              <div
                className="hud-label"
                style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 40 }}
              >
                Nenhum item salvo ainda. Salva no resultado da busca pra ler depois.
              </div>
            )}
            {(saved ?? []).map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${PRIMARY}20`,
                  borderLeft: `2px solid ${PRIMARY}`,
                  borderRadius: 6,
                  opacity: item.read ? 0.5 : 1,
                }}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </a>
                {item.summary && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                    {item.summary.slice(0, 240)}
                  </div>
                )}
                <button
                  onClick={() => remove.mutate(item.id)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 9,
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "rgba(239,68,68,0.6)",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
