import { useMemo, useState } from "react";
import type { MediaKind, MediaStatus, PreferenceLayer } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useCreateMediaItem,
  useMediaHub,
  useMediaRecommendations,
  useRemoveMediaItem,
  useUpdateMediaItem,
} from "../../hooks/modules/useMedia.js";
import { TagPill } from "../../components/visual/TagPill.js";
import { RingGauge } from "../../components/visual/RingGauge.js";

const PRIMARY = "#A78BFA";
const ACCENT = "#00D4FF";

const STATUS_META: Record<MediaStatus, { label: string; color: string; icon: string }> = {
  wishlist:  { label: "WISHLIST",  color: "#F59E0B", icon: "◯" },
  watching:  { label: "ASSISTINDO", color: "#10B981", icon: "▷" },
  finished:  { label: "CONCLUIDO", color: ACCENT,    icon: "◉" },
  paused:    { label: "PAUSADO",   color: "#64748B", icon: "‖" },
  dropped:   { label: "DROPADO",   color: "#EF4444", icon: "×" },
};

const KIND_META: Record<MediaKind, { label: string; icon: string }> = {
  movie:        { label: "FILME",        icon: "▶" },
  series:       { label: "SERIE",        icon: "▦" },
  anime:        { label: "ANIME",        icon: "✦" },
  documentary:  { label: "DOC",          icon: "◇" },
  book:         { label: "LIVRO",        icon: "\u{1F4D6}" },
  manga:        { label: "MANGA",        icon: "\u{1F4D8}" },
  other:        { label: "OUTRO",        icon: "◌" },
};

const LAYER_META: Record<PreferenceLayer, { label: string; color: string; icon: string }> = {
  current:     { label: "ATUAL",       color: ACCENT,   icon: "◆" },
  nostalgia:   { label: "NOSTALGIA",   color: "#F59E0B", icon: "♡" },
  exploration: { label: "EXPLORACAO",  color: PRIMARY,  icon: "✦" },
};

const LAYERS: PreferenceLayer[] = ["current", "nostalgia", "exploration"];
const STATUSES: MediaStatus[] = ["wishlist", "watching", "finished", "paused", "dropped"];
const KINDS: MediaKind[] = ["movie", "series", "anime", "documentary", "other"];

export function MediaPage(): JSX.Element {
  const hub = useMediaHub();
  const createItem = useCreateMediaItem();
  const updateItem = useUpdateMediaItem();
  const removeItem = useRemoveMediaItem();
  const recommend = useMediaRecommendations();
  const data = hub.data;

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MediaKind>("movie");
  const [genres, setGenres] = useState("sci-fi, thriller");
  const [mood, setMood] = useState("intenso");
  const [platform, setPlatform] = useState("");
  const [tasteLayer, setTasteLayer] = useState<PreferenceLayer>("current");
  const [filter, setFilter] = useState<MediaStatus | "all">("all");
  const [requestMood, setRequestMood] = useState("inteligente e tecnologico");

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return filter === "all" ? all : all.filter((item) => item.status === filter);
  }, [data?.items, filter]);

  const totalCount = data?.taste.total ?? 0;
  const finishedPct = totalCount > 0 ? Math.round(((data?.taste.finished ?? 0) / totalCount) * 100) : 0;

  const addItem = (): void => {
    if (!title.trim()) return;
    createItem.mutate(
      {
        title: title.trim(),
        kind,
        genres: genres.split(",").map((g) => g.trim()).filter(Boolean),
        mood,
        platform,
        tasteLayer,
      },
      {
        onSuccess: () => {
          setTitle("");
          setPlatform("");
        },
      },
    );
  };

  const runRecommend = (): void => {
    recommend.mutate({
      mood: requestMood.trim() || undefined,
      intent: "balanced",
      includeAnime: true,
    });
  };

  const recommendations = recommend.data ?? data?.recommendations ?? [];

  return (
    <ModuleShell icon="▷" label="MIDIA" sub="Filmes · series · animes · gosto calibrado" color={PRIMARY}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ━━━ HERO ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                TASTE ENGINE
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <strong style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 28,
                  color: PRIMARY,
                  letterSpacing: "0.1em",
                  textShadow: `0 0 10px ${PRIMARY}66`,
                }}>
                  {totalCount}
                </strong>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em" }}>
                  itens calibrando seu gosto
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 8, maxWidth: 460, lineHeight: 1.5 }}>
                Vault pessoal. Cada item registrado treina o motor de recomendacao com seu padrao real, nao tendencias genericas.
              </p>
            </div>
            <RingGauge value={finishedPct} centerLabel={`${finishedPct}%`} topLabel="CONCLUIDO" bottomLabel={`${data?.taste.finished ?? 0} de ${totalCount}`} color={ACCENT} size={110} />
          </div>

          <div className="hud-divider" />

          <div className="hud-metric-row">
            <MicroStat label="WATCHLIST" value={data?.taste.watchlist ?? 0} color="#F59E0B" />
            <MicroStat label="CONCLUIDOS" value={data?.taste.finished ?? 0} color={ACCENT} />
            <MicroStat label="NOTA MEDIA" value={data?.taste.avgRating ? data.taste.avgRating.toFixed(1) : "—"} color={PRIMARY} />
            <MicroStat label="GENEROS UNICOS" value={data?.taste.topGenres.length ?? 0} color="#10B981" />
          </div>
        </section>

        {/* ━━━ PERFIL DE GOSTO ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14, letterSpacing: "0.22em" }}>
            PERFIL DE GOSTO · 3 CAMADAS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {LAYERS.map((layer) => {
              const meta = LAYER_META[layer];
              const count = data?.taste.layers[layer] ?? 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <article key={layer} style={{
                  padding: "12px 14px",
                  borderRadius: 9,
                  border: `1px solid ${meta.color}33`,
                  background: `linear-gradient(135deg, ${meta.color}12, transparent 70%)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <span style={{ fontSize: 22, color: meta.color, textShadow: `0 0 8px ${meta.color}` }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div className="hud-label" style={{ fontSize: 8, color: meta.color, marginBottom: 2 }}>{meta.label}</div>
                    <strong style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 20,
                      color: meta.color,
                      textShadow: `0 0 6px ${meta.color}66`,
                    }}>
                      {count}
                    </strong>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>{pct}%</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <TasteBlock title="GENEROS DOMINANTES" values={data?.taste.topGenres ?? []} color={PRIMARY} />
            <TasteBlock title="MOODS RECORRENTES" values={data?.taste.topMoods ?? []} color={ACCENT} />
          </div>
        </section>

        {/* ━━━ RECOMENDADOR ━━━ */}
        <section className="dash-section" style={{ borderColor: `${PRIMARY}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16, color: PRIMARY, textShadow: `0 0 8px ${PRIMARY}` }}>◇</span>
                <span className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.22em" }}>
                  RECOMENDADOR ORION
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, maxWidth: 420 }}>
                70% atual · 20% nostalgia · 10% exploracao. Nao finge disponibilidade — sugere com base no seu padrao real.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="orion-input"
                value={requestMood}
                onChange={(e) => setRequestMood(e.target.value)}
                placeholder="mood de hoje"
                style={{ minWidth: 200 }}
              />
              <button
                onClick={runRecommend}
                disabled={recommend.isPending}
                className="orion-command"
                style={{
                  color: PRIMARY,
                  borderColor: `${PRIMARY}77`,
                  background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
                  fontSize: 11,
                  padding: "10px 16px",
                  boxShadow: `0 0 12px ${PRIMARY}33`,
                }}
              >
                {recommend.isPending ? "◌ CALCULANDO..." : "▷ GERAR 3 OPCOES"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }} className="hud-stagger">
            {recommendations.map((item) => {
              const layer = LAYER_META[item.layer];
              const kindMeta = KIND_META[item.kind];
              return (
                <article key={`${item.title}-${item.layer}`} style={{
                  padding: "14px 16px",
                  borderRadius: 9,
                  border: `1px solid ${layer.color}33`,
                  background: `linear-gradient(135deg, ${layer.color}10, transparent 70%)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    padding: "4px 10px",
                    background: `${layer.color}22`,
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 10,
                    color: layer.color,
                    fontWeight: 700,
                    borderBottomLeftRadius: 6,
                    textShadow: `0 0 4px ${layer.color}`,
                  }}>
                    {item.fitScore}%
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TagPill icon={layer.icon} label={layer.label} color={layer.color} size="xs" />
                    <TagPill icon={kindMeta.icon} label={kindMeta.label} color="rgba(255,255,255,0.5)" size="xs" />
                  </div>
                  <strong style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}>
                    {item.title}
                  </strong>
                  <p style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.55,
                    margin: 0,
                    flex: 1,
                  }}>
                    {item.reason}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {item.genres.slice(0, 3).map((g) => (
                      <TagPill key={g} label={g} color={layer.color} size="xs" />
                    ))}
                    <TagPill label={item.mood} color="rgba(255,255,255,0.4)" size="xs" />
                  </div>
                  <button
                    onClick={() => createItem.mutate({
                      title: item.title,
                      kind: item.kind,
                      genres: item.genres,
                      mood: item.mood,
                      tasteLayer: item.layer,
                      status: "wishlist",
                    })}
                    className="orion-command"
                    style={{
                      color: layer.color,
                      borderColor: `${layer.color}55`,
                      background: `${layer.color}15`,
                      fontSize: 10,
                      padding: "6px 10px",
                    }}
                  >
                    + ENVIAR PRA WATCHLIST
                  </button>
                </article>
              );
            })}
            {recommendations.length === 0 && (
              <div style={{
                gridColumn: "1 / -1",
                padding: 28,
                textAlign: "center",
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
                border: "1px dashed rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}>
                Clique GERAR 3 OPCOES pra receber recomendacoes calibradas pro seu gosto.
              </div>
            )}
          </div>
        </section>

        {/* ━━━ ADD AO VAULT ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 12, letterSpacing: "0.22em" }}>
            + ADICIONAR AO VAULT
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
            <input className="orion-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo" />
            <input className="orion-input" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Generos (virgula)" />
            <input className="orion-input" value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Mood" />
            <input className="orion-input" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Plataforma" />
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 6 }}>TIPO</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {KINDS.map((k) => {
                  const meta = KIND_META[k];
                  return (
                    <TagPill
                      key={k}
                      icon={meta.icon}
                      label={meta.label}
                      color={ACCENT}
                      variant={kind === k ? "solid" : "outline"}
                      active={kind === k}
                      onClick={() => setKind(k)}
                      size="xs"
                    />
                  );
                })}
              </div>
            </div>
            <div>
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 6 }}>CAMADA</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {LAYERS.map((l) => {
                  const meta = LAYER_META[l];
                  return (
                    <TagPill
                      key={l}
                      icon={meta.icon}
                      label={meta.label}
                      color={meta.color}
                      variant={tasteLayer === l ? "solid" : "outline"}
                      active={tasteLayer === l}
                      onClick={() => setTasteLayer(l)}
                      size="xs"
                    />
                  );
                })}
              </div>
            </div>
            <button
              onClick={addItem}
              disabled={createItem.isPending || !title.trim()}
              className="orion-command"
              style={{
                color: PRIMARY,
                borderColor: `${PRIMARY}77`,
                background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
                fontSize: 11,
                padding: "10px 16px",
                opacity: !title.trim() ? 0.4 : 1,
              }}
            >
              {createItem.isPending ? "◌ SALVANDO..." : "+ ADICIONAR"}
            </button>
          </div>
        </section>

        {/* ━━━ BIBLIOTECA ━━━ */}
        <section className="dash-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
            <span className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.22em" }}>
              BIBLIOTECA · {items.length}
            </span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <TagPill label="TODOS" color={ACCENT} variant={filter === "all" ? "solid" : "outline"} active={filter === "all"} onClick={() => setFilter("all")} />
              {STATUSES.map((s) => {
                const meta = STATUS_META[s];
                return (
                  <TagPill
                    key={s}
                    icon={meta.icon}
                    label={meta.label}
                    color={meta.color}
                    variant={filter === s ? "solid" : "outline"}
                    active={filter === s}
                    onClick={() => setFilter(s)}
                  />
                );
              })}
            </div>
          </div>

          {items.length === 0 ? (
            <div style={{
              padding: 30,
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 8,
            }}>
              {(data?.items.length ?? 0) === 0 ? "Vault vazio. Adicione um filme/serie acima pra comecar a calibrar seu gosto." : "Nenhum item neste filtro."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }} className="hud-stagger">
              {items.map((item) => {
                const statusMeta = STATUS_META[item.status];
                const kindMeta = KIND_META[item.kind];
                const layerMeta = LAYER_META[item.tasteLayer];
                return (
                  <article key={item.id} style={{
                    borderRadius: 9,
                    border: `1px solid ${statusMeta.color}33`,
                    background: "linear-gradient(135deg, rgba(255,255,255,0.012), transparent)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    {/* "Poster" — gradient com inicial estilizada */}
                    <div style={{
                      height: 100,
                      background: `
                        linear-gradient(135deg, ${layerMeta.color}30, ${statusMeta.color}15 60%, transparent),
                        radial-gradient(circle at 30% 30%, ${layerMeta.color}40, transparent 70%)
                      `,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderBottom: `1px solid ${statusMeta.color}22`,
                    }}>
                      <span style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: 42,
                        color: `${layerMeta.color}DD`,
                        textShadow: `0 0 16px ${layerMeta.color}`,
                        letterSpacing: "0.05em",
                        fontWeight: 700,
                      }}>
                        {item.title.slice(0, 2).toUpperCase()}
                      </span>
                      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
                        <TagPill icon={kindMeta.icon} label={kindMeta.label} color={ACCENT} size="xs" />
                      </div>
                      <div style={{ position: "absolute", top: 8, right: 8 }}>
                        <TagPill icon={statusMeta.icon} label={statusMeta.label} color={statusMeta.color} variant="solid" size="xs" />
                      </div>
                      {item.rating && (
                        <div style={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          padding: "3px 7px",
                          background: "#030509CC",
                          border: `1px solid ${PRIMARY}55`,
                          borderRadius: 4,
                          fontSize: 11,
                          color: PRIMARY,
                          fontFamily: "'Share Tech Mono', monospace",
                          fontWeight: 700,
                        }}>
                          ★ {item.rating}/5
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <strong style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.3 }}>
                        {item.title}
                      </strong>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)" }}>
                        {item.genres.slice(0, 3).join(" · ") || "sem genero"}
                      </span>
                      {item.platform && (
                        <span style={{ fontSize: 9.5, color: layerMeta.color, letterSpacing: "0.04em" }}>
                          ▶ {item.platform}
                        </span>
                      )}
                      <div style={{ display: "flex", gap: 5, marginTop: "auto", paddingTop: 8 }}>
                        <select
                          value={item.status}
                          onChange={(e) => updateItem.mutate({ id: item.id, input: { status: e.target.value as MediaStatus } })}
                          className="orion-input"
                          style={{ fontSize: 9, padding: "4px 6px", flex: 1 }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                        <select
                          value={item.rating ?? ""}
                          onChange={(e) => updateItem.mutate({ id: item.id, input: { rating: e.target.value ? Number(e.target.value) : null } })}
                          className="orion-input"
                          style={{ fontSize: 9, padding: "4px 6px", width: 50 }}
                        >
                          <option value="">★</option>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeItem.mutate(item.id)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 10,
                            background: "transparent",
                            border: `1px solid ${"#EF4444"}33`,
                            color: "#EF4444",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                          title="Remover"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <ModuleChat
        module="media"
        label="MIDIA"
        color={PRIMARY}
        welcome="Me diz o que voce quer assistir, ouvir ou ler — eu adiciono na sua lista automaticamente e sugiro conteudo baseado no seu gosto."
        suggestions={["Recomende um filme", "Adicionar na lista", "O que assistir hoje?", "Podcasts sobre tech"]}
      />
    </ModuleShell>
  );
}

function MicroStat({ label, value, color }: { label: string; value: number | string; color: string }): JSX.Element {
  return (
    <div className="hud-metric" style={{ "--accent": color } as React.CSSProperties}>
      <small style={{ color }}>{label}</small>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function TasteBlock({ title, values, color }: { title: string; values: Array<{ name: string; count: number }>; color: string }): JSX.Element {
  const max = values.length > 0 ? Math.max(...values.map((v) => v.count)) : 1;
  return (
    <div>
      <div className="hud-label" style={{ color, fontSize: 9, marginBottom: 10, letterSpacing: "0.22em" }}>
        {title}
      </div>
      {values.length === 0 ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>calibrando...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {values.slice(0, 6).map((v) => {
            const pct = (v.count / max) * 100;
            return (
              <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", minWidth: 80, textTransform: "capitalize" }}>
                  {v.name}
                </span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}99, ${color})`,
                    boxShadow: `0 0 4px ${color}66`,
                    borderRadius: 2,
                  }} />
                </div>
                <span style={{ fontSize: 11, color, fontFamily: "'Share Tech Mono', monospace", minWidth: 18, textAlign: "right" }}>
                  {v.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
