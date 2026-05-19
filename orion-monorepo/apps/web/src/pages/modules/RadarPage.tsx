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

interface SmartCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** query template (substitui {q} se houver) */
  query: string;
  freshness: Freshness;
  /** placeholder pra search complementar */
  placeholder?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   RADAR INTELIGENTE — categorias com queries especializadas usando
   operadores do Brave Search (site:, OR, exclusões). Cada categoria
   filtra o ruído ANTES de chegar no Brave.

   Por que "vagas dev" no Brave puro retorna lixo: porque "vagas dev"
   isolado bate em qualquer coisa. Adicionando site: linkedin.com/jobs
   + sites brasileiros + exclusão de termos irrelevantes vira útil.
═══════════════════════════════════════════════════════════════════ */

const CATEGORIES: SmartCategory[] = [
  {
    id: "vagas_dev",
    label: "VAGAS DEV",
    icon: "↑",
    color: "#00D4FF",
    query:
      '(vagas OR vaga OR "we are hiring" OR job) (dev OR developer OR engineer OR programador) (remoto OR remote OR híbrido OR brasil OR br) (site:linkedin.com/jobs OR site:vagas.com.br OR site:gupy.io OR site:programathor.com.br OR site:trampos.co) -neymar -futebol',
    freshness: "pw",
    placeholder: "stack ou senioridade (ex: react senior)",
  },
  {
    id: "vagas_design",
    label: "VAGAS DESIGN",
    icon: "✦",
    color: "#7C3AED",
    query:
      '(vagas OR vaga OR hiring) (designer OR design) (UI OR UX OR product OR system) (remoto OR remote OR brasil OR br) (site:linkedin.com/jobs OR site:vagas.com.br OR site:gupy.io)',
    freshness: "pw",
    placeholder: "área de design",
  },
  {
    id: "tech_news",
    label: "NOTÍCIAS TECH",
    icon: "◌",
    color: "#10B981",
    query:
      'tech news 2026 (site:techcrunch.com OR site:theverge.com OR site:tecmundo.com.br OR site:olhardigital.com.br OR site:hackernews OR site:news.ycombinator.com)',
    freshness: "pd",
    placeholder: "tópico específico",
  },
  {
    id: "ia",
    label: "IA / LLM",
    icon: "◉",
    color: "#F59E0B",
    query:
      '("AI" OR "LLM" OR "GPT" OR "Claude" OR "Gemini" OR "agente IA") (release OR launch OR update OR new) (site:techcrunch.com OR site:theverge.com OR site:venturebeat.com OR site:tecmundo.com.br OR site:anthropic.com OR site:openai.com)',
    freshness: "pw",
    placeholder: "modelo ou capacidade",
  },
  {
    id: "games_release",
    label: "LANÇAMENTOS GAMES",
    icon: "▣",
    color: "#EC4899",
    query:
      '(game OR jogo) (release OR launch OR lançamento OR DLC) 2026 (site:ign.com OR site:rockpapershotgun.com OR site:gamespot.com OR site:steamcommunity.com OR site:epicgames.com OR site:gamerant.com OR site:eurogamer.pt)',
    freshness: "pw",
    placeholder: "gênero ou plataforma",
  },
  {
    id: "anime",
    label: "ANIME RECENTE",
    icon: "♢",
    color: "#EC4899",
    query:
      '(anime OR manga) (announcement OR season OR episode OR release) (site:crunchyroll.com/news OR site:animenewsnetwork.com OR site:myanimelist.net/news OR site:comicbook.com/anime)',
    freshness: "pw",
    placeholder: "título do anime",
  },
  {
    id: "eventos_geek",
    label: "EVENTOS GEEK BR",
    icon: "▷",
    color: "#7C3AED",
    query:
      '(CCXP OR "Anime Friends" OR "Brasil Game Show" OR "BGS" OR "Comic Con" OR convenção geek OR evento geek) 2026 brasil ingresso',
    freshness: "pm",
    placeholder: "cidade ou evento",
  },
  {
    id: "trends_dev",
    label: "TENDÊNCIAS DEV",
    icon: "↻",
    color: "#00D4FF",
    query:
      '(framework OR linguagem OR ferramenta) (popular OR trending OR "state of") (web OR backend OR mobile) 2026 (site:stateofjs.com OR site:thoughtworks.com OR site:github.blog OR site:dev.to OR site:medium.com)',
    freshness: "pm",
    placeholder: "área da stack",
  },
];

const FRESHNESS: Array<{ id: Freshness; label: string }> = [
  { id: "pd", label: "24H" },
  { id: "pw", label: "SEMANA" },
  { id: "pm", label: "MÊS" },
];

function buildQuery(cat: SmartCategory | null, extra: string, freshness: Freshness): string {
  if (!cat) return extra.trim();
  if (!extra.trim()) return cat.query;
  return `${extra.trim()} ${cat.query}`;
}

export function RadarPage(): JSX.Element {
  const [activeCat, setActiveCat] = useState<SmartCategory | null>(null);
  const [extra, setExtra] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [freshness, setFreshness] = useState<Freshness>("pw");
  const [tab, setTab] = useState<"smart" | "free" | "saved">("smart");

  const search = useSearchNews();
  const save = useSaveNews();
  const remove = useRemoveNews();
  const { data: saved } = useSavedNews();

  const handleCatSearch = (cat: SmartCategory): void => {
    setActiveCat(cat);
    setFreshness(cat.freshness);
    const q = buildQuery(cat, "", cat.freshness);
    search.mutate({ query: q, freshness: cat.freshness });
  };

  const handleRefineSearch = (): void => {
    if (!activeCat) return;
    const q = buildQuery(activeCat, extra, freshness);
    search.mutate({ query: q, freshness });
  };

  const handleFreeSearch = (): void => {
    if (!customQuery.trim()) return;
    search.mutate({ query: customQuery.trim(), freshness });
  };

  return (
    <ModuleShell icon="◌" label="RADAR" sub="Inteligente · Filtrado · Salvável" color={PRIMARY}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {(["smart", "free", "saved"] as const).map((t) => (
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
              {t === "smart" ? "✦ INTELIGENTE" : t === "free" ? "◌ BUSCA LIVRE" : `📑 SALVOS · ${saved?.length ?? 0}`}
            </button>
          ))}
        </div>

        {tab === "smart" && (
          <>
            {/* Grid de categorias */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCatSearch(c)}
                  className="hud-label"
                  style={{
                    padding: "12px 10px",
                    fontSize: 10,
                    background: activeCat?.id === c.id ? `${c.color}25` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${activeCat?.id === c.id ? c.color : "rgba(255,255,255,0.08)"}`,
                    borderLeft: `3px solid ${c.color}`,
                    color: activeCat?.id === c.id ? c.color : "rgba(255,255,255,0.65)",
                    borderRadius: 6,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Refinamento de categoria ativa */}
            {activeCat && (
              <div
                style={{
                  padding: 12,
                  marginBottom: 16,
                  background: `${activeCat.color}10`,
                  border: `1px solid ${activeCat.color}30`,
                  borderRadius: 8,
                }}
              >
                <div
                  className="hud-label"
                  style={{ fontSize: 9, color: activeCat.color, marginBottom: 8 }}
                >
                  ↳ REFINAR: {activeCat.label}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRefineSearch()}
                    placeholder={activeCat.placeholder ?? "filtro adicional"}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 5,
                      color: "#fff",
                      fontSize: 12,
                      outline: "none",
                      fontFamily: "'Rajdhani', sans-serif",
                    }}
                  />
                  <button
                    onClick={handleRefineSearch}
                    disabled={search.isPending}
                    className="hud-label"
                    style={{
                      padding: "6px 12px",
                      fontSize: 9,
                      background: `${activeCat.color}25`,
                      border: `1px solid ${activeCat.color}55`,
                      color: activeCat.color,
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                  >
                    {search.isPending ? "…" : "BUSCAR"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "free" && (
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
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFreeSearch()}
                placeholder='Busca livre (sem filtros — pode trazer ruído)'
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
                onClick={handleFreeSearch}
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
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
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
            <div
              style={{
                marginTop: 10,
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              💡 Dica: pra filtrar por site, use <code>site:linkedin.com/jobs sua busca</code>
            </div>
          </div>
        )}

        {/* Resultados */}
        {tab !== "saved" && search.data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {search.data.length === 0 && (
              <div
                className="hud-label"
                style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 30 }}
              >
                Nada encontrado. Tenta refinar.
              </div>
            )}
            {search.data.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${(activeCat?.color ?? PRIMARY)}20`,
                  borderLeft: `2px solid ${activeCat?.color ?? PRIMARY}`,
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
                      color: "rgba(255,255,255,0.92)",
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
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'Share Tech Mono', monospace",
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new URL(r.url).hostname.replace("www.", "")}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.55)",
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}
                >
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
                      background: `${activeCat?.color ?? PRIMARY}15`,
                      border: `1px solid ${activeCat?.color ?? PRIMARY}40`,
                      color: activeCat?.color ?? PRIMARY,
                      borderRadius: 4,
                      textDecoration: "none",
                    }}
                  >
                    ABRIR ↗
                  </a>
                  <button
                    onClick={() =>
                      save.mutate({
                        title: r.title,
                        url: r.url,
                        summary: r.description,
                        category: activeCat?.id ?? "livre",
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

        {tab === "saved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(saved ?? []).length === 0 && (
              <div
                className="hud-label"
                style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 40 }}
              >
                Nada salvo ainda.
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
                <div
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'Share Tech Mono', monospace",
                    marginBottom: 6,
                  }}
                >
                  [{item.category}] · {new URL(item.url).hostname.replace("www.", "")}
                </div>
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
