import { useState } from "react";
import type { JobModality, JobSeniority } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useJobRadar,
  useRemoveNews,
  useSaveNews,
  useSavedNews,
  useSearchNews,
} from "../../hooks/modules/useNews.js";

const PRIMARY = "#EC4899";

type Freshness = "pd" | "pw" | "pm";
type Tab = "jobs" | "pipeline" | "smart" | "free" | "saved";

interface SmartCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  query: string;
  freshness: Freshness;
  placeholder?: string;
}

const CATEGORIES: SmartCategory[] = [
  {
    id: "tech_news",
    label: "NOTICIAS TECH",
    icon: "◌",
    color: "#10B981",
    query:
      'tech news 2026 (site:techcrunch.com OR site:theverge.com OR site:tecmundo.com.br OR site:olhardigital.com.br OR site:news.ycombinator.com)',
    freshness: "pd",
    placeholder: "topico especifico",
  },
  {
    id: "ia",
    label: "IA / LLM",
    icon: "◉",
    color: "#F59E0B",
    query:
      '("AI" OR "LLM" OR "Claude" OR "GPT" OR "Gemini" OR "agente IA") (release OR launch OR update OR new) (site:anthropic.com OR site:openai.com OR site:techcrunch.com OR site:theverge.com)',
    freshness: "pw",
    placeholder: "modelo ou capacidade",
  },
  {
    id: "games_release",
    label: "GAMES",
    icon: "▣",
    color: "#7C3AED",
    query:
      '(game OR jogo) (release OR launch OR lancamento OR DLC) 2026 (site:ign.com OR site:gamespot.com OR site:steamcommunity.com OR site:eurogamer.pt)',
    freshness: "pw",
    placeholder: "genero ou plataforma",
  },
  {
    id: "eventos_geek",
    label: "EVENTOS GEEK BR",
    icon: "▷",
    color: "#00D4FF",
    query:
      '(CCXP OR "Anime Friends" OR "Brasil Game Show" OR BGS OR "Comic Con" OR evento geek) 2026 brasil ingresso',
    freshness: "pm",
    placeholder: "cidade ou evento",
  },
];

function host(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "web";
  }
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function RadarPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>("jobs");
  const [activeCat, setActiveCat] = useState<SmartCategory | null>(null);
  const [extra, setExtra] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [freshness, setFreshness] = useState<Freshness>("pw");
  const [role, setRole] = useState("frontend developer");
  const [stack, setStack] = useState("React, TypeScript, Node");
  const [seniority, setSeniority] = useState<JobSeniority>("pleno");
  const [modality, setModality] = useState<JobModality>("remote");
  const [location, setLocation] = useState("Brasil");
  const [international, setInternational] = useState(false);

  const search = useSearchNews();
  const jobs = useJobRadar();
  const [applications, setApplications] = useState<Array<{id: string; title: string; company: string; status: "quero_aplicar" | "aplicado" | "entrevista" | "rejeitado" | "aceito"; url: string; addedAt: string}>>([]);

  const addApplication = (title: string, url: string): void => {
    const company = title.split(" - ")[1]?.trim() || title.split("|")[1]?.trim() || "—";
    setApplications((prev) => [...prev, { id: crypto.randomUUID(), title: title.slice(0, 80), company, status: "quero_aplicar", url, addedAt: new Date().toISOString() }]);
  };

  const updateAppStatus = (id: string, status: typeof applications[number]["status"]): void => {
    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  };
  const save = useSaveNews();
  const remove = useRemoveNews();
  const { data: saved } = useSavedNews();

  const runCategory = (cat: SmartCategory): void => {
    setActiveCat(cat);
    setFreshness(cat.freshness);
    search.mutate({ query: extra.trim() ? `${extra.trim()} ${cat.query}` : cat.query, freshness: cat.freshness });
  };

  const runFreeSearch = (): void => {
    if (!customQuery.trim()) return;
    search.mutate({ query: customQuery.trim(), freshness });
  };

  const runJobs = (): void => {
    jobs.mutate({
      role,
      stack: splitList(stack),
      seniority,
      modality,
      location,
      includeInternational: international,
      excludeTerms: ["neymar", "futebol", "bet", "aposta"],
    });
  };

  return (
    <ModuleShell icon="◌" label="RADAR" sub="Vagas · tendencias · oportunidades" color={PRIMARY}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {(["jobs", "smart", "free", "saved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="hud-label"
              style={{
                padding: "8px 14px",
                fontSize: 10,
                background: tab === t ? `${PRIMARY}20` : "transparent",
                border: `1px solid ${tab === t ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                color: tab === t ? PRIMARY : "rgba(255,255,255,0.42)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {t === "jobs" ? "↑ VAGAS GUIADAS" : t === "smart" ? "✦ RADAR" : t === "free" ? "◌ LIVRE" : `SALVOS · ${saved?.length ?? 0}`}
            </button>
          ))}
        </div>

        {tab === "jobs" && (
          <>
            <div
              style={{
                padding: 16,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(0,212,255,0.22)",
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              <div className="hud-label" style={{ fontSize: 10, color: "#00D4FF", marginBottom: 12 }}>
                ORQUESTRADOR DE VAGAS
              </div>
              <div className="radar-job-grid">
                <Field label="Cargo" value={role} onChange={setRole} />
                <Field label="Stack" value={stack} onChange={setStack} />
                <Field label="Local" value={location} onChange={setLocation} />
                <SelectField
                  label="Nivel"
                  value={seniority}
                  onChange={(v) => setSeniority(v as JobSeniority)}
                  options={[
                    ["any", "Qualquer"],
                    ["junior", "Junior"],
                    ["pleno", "Pleno"],
                    ["senior", "Senior"],
                    ["lead", "Lead"],
                  ]}
                />
                <SelectField
                  label="Modelo"
                  value={modality}
                  onChange={(v) => setModality(v as JobModality)}
                  options={[
                    ["remote", "Remoto"],
                    ["hybrid", "Hibrido"],
                    ["onsite", "Presencial"],
                    ["any", "Qualquer"],
                  ]}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "end",
                    gap: 8,
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 11,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={international}
                    onChange={(e) => setInternational(e.target.checked)}
                  />
                  incluir LATAM/global
                </label>
              </div>
              <button
                onClick={runJobs}
                disabled={jobs.isPending}
                className="hud-label"
                style={{
                  marginTop: 12,
                  padding: "9px 14px",
                  background: "rgba(0,212,255,0.18)",
                  border: "1px solid rgba(0,212,255,0.6)",
                  color: "#00D4FF",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {jobs.isPending ? "VARRENDO FONTES..." : "BUSCAR VAGAS COM SCORE"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(jobs.data ?? []).map((r) => (
                <ResultCard
                  key={r.url}
                  title={r.title}
                  url={r.url}
                  description={r.description}
                  meta={`${r.fitScore}% fit · ${r.source}${r.signals.length ? ` · ${r.signals.join(" · ")}` : ""}`}
                  color={r.fitScore >= 70 ? "#10B981" : r.fitScore >= 55 ? "#F59E0B" : "#00D4FF"}
                  onSave={() =>
                    save.mutate({
                      title: r.title,
                      url: r.url,
                      summary: r.description,
                      source: r.source,
                      category: "vagas",
                    })
                  }
                  onApply={() => addApplication(r.title, r.url)}
                />
              ))}
            </div>
          </>
        )}

        {tab === "pipeline" && (
          <div>
            {applications.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(236,72,153,0.2)", borderRadius: 10 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{String.fromCodePoint(0x1F4CB)}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Nenhuma candidatura. Busque vagas e clique APLICAR pra adicionar ao pipeline.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {(["quero_aplicar", "aplicado", "entrevista", "rejeitado", "aceito"] as const).map((status) => {
                  const statusMeta = { quero_aplicar: { label: "QUERO APLICAR", color: "#F59E0B" }, aplicado: { label: "APLICADO", color: "#00D4FF" }, entrevista: { label: "ENTREVISTA", color: "#7C3AED" }, rejeitado: { label: "REJEITADO", color: "#EF4444" }, aceito: { label: "ACEITO", color: "#10B981" } };
                  const meta = statusMeta[status];
                  const apps = applications.filter((a) => a.status === status);
                  return (
                    <div key={status} style={{ padding: 12, background: "rgba(255,255,255,0.015)", border: `1px solid ${meta.color}22`, borderRadius: 8, minHeight: 120 }}>
                      <div className="hud-label" style={{ fontSize: 9, color: meta.color, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${meta.color}22` }}>{meta.label} ({apps.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {apps.map((a) => (
                          <div key={a.id} style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${meta.color}15`, borderRadius: 4, fontSize: 10 }}>
                            <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontWeight: 600, fontSize: 11 }}>{a.title}</a>
                            <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                              {(["quero_aplicar", "aplicado", "entrevista", "rejeitado", "aceito"] as const).filter((s) => s !== status).map((s) => (<button key={s} onClick={() => updateAppStatus(a.id, s)} style={{ padding: "1px 5px", fontSize: 7, background: "transparent", border: `1px solid ${statusMeta[s].color}30`, color: statusMeta[s].color, borderRadius: 2, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>{statusMeta[s].label}</button>))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

                {tab === "smart" && (
          <>
            <div className="radar-category-grid">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => runCategory(c)}
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
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            {activeCat && (
              <div style={{ display: "flex", gap: 8, margin: "12px 0 16px" }}>
                <input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runCategory(activeCat)}
                  placeholder={activeCat.placeholder ?? "refinar"}
                  className="orion-input"
                />
                <button onClick={() => runCategory(activeCat)} className="orion-command">
                  REFINAR
                </button>
              </div>
            )}
          </>
        )}

        {tab === "free" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runFreeSearch()}
              placeholder="Busca livre. Use site:, -termo, OR..."
              className="orion-input"
            />
            <button onClick={runFreeSearch} className="orion-command">
              BUSCAR
            </button>
          </div>
        )}

        {tab !== "jobs" && tab !== "saved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(search.data ?? []).map((r) => (
              <ResultCard
                key={r.url}
                title={r.title}
                url={r.url}
                description={r.description}
                meta={`${host(r.url)}${r.age ? ` · ${r.age}` : ""}`}
                color={activeCat?.color ?? PRIMARY}
                onSave={() =>
                  save.mutate({
                    title: r.title,
                    url: r.url,
                    summary: r.description,
                    source: host(r.url),
                    category: activeCat?.id ?? "livre",
                  })
                }
              />
            ))}
          </div>
        )}

        {tab === "saved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(saved ?? []).length === 0 && (
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 40 }}>
                NADA SALVO AINDA
              </div>
            )}
            {(saved ?? []).map((item) => (
              <ResultCard
                key={item.id}
                title={item.title}
                url={item.url}
                description={item.summary ?? ""}
                meta={`${item.category} · ${host(item.url)}`}
                color={PRIMARY}
                onSave={() => remove.mutate(item.id)}
                saveLabel="REMOVER"
              />
            ))}
          </div>
        )}
      </div>
      <ModuleChat
        module="radar"
        label="RADAR"
        color={PRIMARY}
        welcome="Posso buscar noticias, tendencias, vagas e eventos relevantes pra voce. O que quer saber?"
        suggestions={["Noticias de tech", "Tendencias da semana", "Vagas na minha area", "Eventos proximos"]}
      />
    </ModuleShell>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label>
      <span className="hud-label" style={{ display: "block", fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>
        {props.label}
      </span>
      <input value={props.value} onChange={(e) => props.onChange(e.target.value)} className="orion-input" />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}): JSX.Element {
  return (
    <label>
      <span className="hud-label" style={{ display: "block", fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>
        {props.label}
      </span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className="orion-input">
        {props.options.map(([value, label]) => (
          <option key={value} value={value} style={{ background: "#0A0F1A", color: "#fff" }}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResultCard(props: {
  title: string;
  url: string;
  description: string;
  meta: string;
  color: string;
  onSave: () => void;
  onApply?: () => void;
  saveLabel?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${props.color}25`,
        borderLeft: `2px solid ${props.color}`,
        borderRadius: 6,
      }}
    >
      <a href={props.url} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.92)", fontWeight: 700, textDecoration: "none" }}>
        {props.title}
      </a>
      <div className="hud-label" style={{ fontSize: 8, color: props.color, margin: "5px 0" }}>
        {props.meta}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: 8 }}>
        {props.description.slice(0, 260)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <a href={props.url} target="_blank" rel="noreferrer" className="orion-link-button">
          ABRIR
        </a>
        <button onClick={props.onSave} className="orion-link-button">
          {props.saveLabel ?? "SALVAR"}
        </button>
        {props.onApply && (<button onClick={props.onApply} className="orion-link-button" style={{ color: "#7C3AED", borderColor: "#7C3AED40" }}>PIPELINE</button>)}
      </div>
    </div>
  );
}
