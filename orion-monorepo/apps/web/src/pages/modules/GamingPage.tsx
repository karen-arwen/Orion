import { useMemo, useState, type CSSProperties } from "react";
import type { GameCatalogItem, GameEntry, GameStatus } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { useGaming } from "../../hooks/modules/useGaming.js";

const COLOR = "#7C3AED";
const STATUS_META: Array<{ id: GameStatus; label: string; hint: string }> = [
  { id: "want", label: "QUER JOGAR", hint: "watchlist" },
  { id: "playing", label: "JOGANDO", hint: "sessao ativa" },
  { id: "beaten", label: "ZEROU", hint: "arquivo" },
  { id: "dropped", label: "DROPPED", hint: "pausado" },
];

export function GamingPage(): JSX.Element {
  const { summary, catalog, isLoading, error, search, loadTrending, create, update, remove } = useGaming();
  const [query, setQuery] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualPlatform, setManualPlatform] = useState("PC");

  const grouped = useMemo(
    () =>
      STATUS_META.map((status) => ({
        ...status,
        games: summary.games.filter((game) => game.status === status.id),
      })),
    [summary.games],
  );

  const addManual = (): void => {
    if (!manualTitle.trim()) return;
    void create({ title: manualTitle, platform: manualPlatform, status: "want" }).then(() => {
      setManualTitle("");
    });
  };

  const addFromCatalog = (item: GameCatalogItem): void => {
    void create({
      title: item.title,
      platform: item.platforms[0] ?? "PC",
      status: "want",
      genre: item.genres[0],
      rating: item.rating ? Math.round(Math.min(10, item.rating * 2)) : undefined,
      coverUrl: item.coverUrl ?? undefined,
      rawgId: item.rawgId,
    });
  };

  return (
    <ModuleShell icon="GAME" label="GAMING" sub="Deals · Builds · Companion" color={COLOR}>
      <div style={layoutStyle}>
        <section style={heroStyle}>
          <div>
            <div className="hud-label" style={labelStyle}>GAME COMPANION</div>
            <h1 style={titleStyle}>Biblioteca viva, backlog inteligente e radar de jogos.</h1>
            <p style={copyStyle}>
              O.R.I.O.N cruza sua watchlist, status, generos e catalogo RAWG para sugerir o proximo jogo
              sem empilhar backlog inutil.
            </p>
          </div>
          <div style={statsGridStyle}>
            <Metric label="biblioteca" value={String(summary.games.length)} />
            <Metric label="jogando" value={String(summary.games.filter((game) => game.status === "playing").length)} />
            <Metric label="deals" value={String(summary.dealWatch.length)} />
          </div>
        </section>

        <section style={toolGridStyle}>
          <div style={panelStyle}>
            <div className="hud-label" style={labelStyle}>CATALOGO RAWG</div>
            <div style={searchRowStyle}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void search(query);
                }}
                placeholder="buscar jogo: Hades, Hollow Knight, Cyberpunk..."
                style={inputStyle}
              />
              <button className="hud-label" disabled={isLoading} onClick={() => void search(query)} style={buttonStyle}>BUSCAR</button>
              <button className="hud-label" disabled={isLoading} onClick={() => void loadTrending()} style={ghostButtonStyle}>TRENDING</button>
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <div style={catalogGridStyle}>
              {catalog.map((item) => (
                <CatalogCard key={item.rawgId} item={item} onAdd={() => addFromCatalog(item)} />
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <div className="hud-label" style={labelStyle}>ADICIONAR MANUAL</div>
            <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="nome do jogo" style={inputStyle} />
            <select value={manualPlatform} onChange={(event) => setManualPlatform(event.target.value)} style={inputStyle}>
              <option>PC</option>
              <option>PlayStation 5</option>
              <option>Xbox Series</option>
              <option>Nintendo Switch</option>
              <option>Mobile</option>
            </select>
            <button className="hud-label" disabled={isLoading} onClick={addManual} style={buttonStyle}>SALVAR NA SHELF</button>

            <div style={recommendBoxStyle}>
              <div className="hud-label" style={labelStyle}>PROXIMO JOGO</div>
              {summary.recommendations.length === 0 ? (
                <p style={copyStyle}>Adicione alguns jogos e notas para o companion aprender seu gosto.</p>
              ) : (
                summary.recommendations.map((rec) => (
                  <div key={`${rec.title}-${rec.fitScore}`} style={recommendationStyle}>
                    <strong>{rec.title}</strong>
                    <span>{rec.reason}</span>
                    <small>{rec.fitScore}% match · {rec.platform}</small>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section style={shelfStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div className="hud-label" style={labelStyle}>GAME SHELF</div>
              <p style={copyStyle}>Mova jogos entre estados e mantenha o backlog sob controle.</p>
            </div>
          </div>
          <div style={columnsStyle}>
            {grouped.map((column) => (
              <div key={column.id} style={columnStyle}>
                <div style={columnHeaderStyle}>
                  <span className="hud-label">{column.label}</span>
                  <small>{column.hint}</small>
                </div>
                {column.games.map((game) => (
                  <GameCard key={game.id} game={game} onUpdate={update} onRemove={remove} />
                ))}
                {column.games.length === 0 && <div style={emptyStyle}>Nenhum jogo aqui ainda.</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ModuleShell>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={metricStyle}>
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function CatalogCard({ item, onAdd }: { item: GameCatalogItem; onAdd: () => void }): JSX.Element {
  return (
    <div style={{ ...catalogCardStyle, backgroundImage: item.coverUrl ? `linear-gradient(180deg, rgba(3,5,9,0.12), rgba(3,5,9,0.92)), url(${item.coverUrl})` : undefined }}>
      <div>
        <strong>{item.title}</strong>
        <span>{item.genres.slice(0, 2).join(" · ") || "catalogo"}</span>
      </div>
      <button className="hud-label" onClick={onAdd} style={smallButtonStyle}>ADD</button>
    </div>
  );
}

function GameCard({
  game,
  onUpdate,
  onRemove,
}: {
  game: GameEntry;
  onUpdate: (id: string, input: { status?: GameStatus; dealActive?: boolean }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}): JSX.Element {
  return (
    <div style={gameCardStyle}>
      {game.coverUrl && <div style={{ ...coverStyle, backgroundImage: `url(${game.coverUrl})` }} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={gameTitleStyle}>{game.title}</div>
        <div style={gameMetaStyle}>{game.platform} · {game.genre ?? "sem genero"} · {game.hoursPlayed}h</div>
        <div style={moveGridStyle}>
          {STATUS_META.map((status) => (
            <button
              key={status.id}
              className="hud-label"
              disabled={game.status === status.id}
              onClick={() => void onUpdate(game.id, { status: status.id })}
              style={miniButtonStyle}
            >
              {status.label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div style={cardActionsStyle}>
        <button onClick={() => void onUpdate(game.id, { dealActive: !game.dealActive })} style={iconButtonStyle}>$</button>
        <button onClick={() => void onRemove(game.id)} style={iconButtonStyle}>x</button>
      </div>
    </div>
  );
}

const layoutStyle: CSSProperties = { display: "grid", gap: 18 };
const heroStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "stretch", padding: 22, border: `1px solid ${COLOR}26`, borderRadius: 10, background: `linear-gradient(135deg, rgba(124,58,237,0.18), rgba(10,15,26,0.78))`, boxShadow: `0 0 46px ${COLOR}12` };
const labelStyle: CSSProperties = { color: COLOR, fontSize: 10, letterSpacing: "0.14em", marginBottom: 12 };
const titleStyle: CSSProperties = { margin: 0, maxWidth: 780, fontSize: "clamp(26px, 4vw, 46px)", lineHeight: 1, color: "#fff", letterSpacing: 0 };
const copyStyle: CSSProperties = { color: "rgba(255,255,255,0.58)", fontSize: 16, lineHeight: 1.5, margin: 0 };
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 };
const metricStyle: CSSProperties = { minHeight: 112, display: "grid", alignContent: "center", padding: 14, border: `1px solid ${COLOR}30`, borderRadius: 8, background: "rgba(3,5,9,0.52)" };
const toolGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18 };
const panelStyle: CSSProperties = { padding: 18, border: `1px solid ${COLOR}22`, borderRadius: 10, background: "rgba(10,15,26,0.78)", overflow: "hidden" };
const searchRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10 };
const inputStyle: CSSProperties = { width: "100%", minHeight: 44, padding: "10px 12px", marginBottom: 10, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLOR}34`, borderRadius: 7, color: "#fff", fontSize: 15 };
const buttonStyle: CSSProperties = { minHeight: 44, padding: "10px 14px", background: "rgba(124,58,237,0.22)", border: `1px solid ${COLOR}70`, color: "#fff", borderRadius: 7, cursor: "pointer", fontSize: 10 };
const ghostButtonStyle: CSSProperties = { ...buttonStyle, background: "rgba(255,255,255,0.035)", color: COLOR };
const errorStyle: CSSProperties = { color: "#F87171", fontSize: 13, margin: "8px 0 12px" };
const catalogGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, maxHeight: 460, overflowY: "auto", paddingRight: 4 };
const catalogCardStyle: CSSProperties = { minHeight: 190, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 12, border: `1px solid ${COLOR}26`, borderRadius: 8, backgroundColor: "rgba(3,5,9,0.68)", backgroundSize: "cover", backgroundPosition: "center", color: "#fff" };
const smallButtonStyle: CSSProperties = { alignSelf: "flex-start", padding: "8px 12px", border: `1px solid ${COLOR}60`, borderRadius: 6, background: "rgba(3,5,9,0.72)", color: "#fff", cursor: "pointer", fontSize: 9 };
const recommendBoxStyle: CSSProperties = { marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" };
const recommendationStyle: CSSProperties = { display: "grid", gap: 4, padding: 12, marginBottom: 10, border: `1px solid ${COLOR}28`, borderRadius: 8, background: "rgba(3,5,9,0.48)", color: "rgba(255,255,255,0.72)" };
const shelfStyle: CSSProperties = { padding: 18, border: `1px solid ${COLOR}22`, borderRadius: 10, background: "rgba(10,15,26,0.64)" };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 14 };
const columnsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 };
const columnStyle: CSSProperties = { minHeight: 320, padding: 12, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, background: "rgba(255,255,255,0.018)" };
const columnHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.42)", marginBottom: 12, fontSize: 10 };
const emptyStyle: CSSProperties = { padding: 16, border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(255,255,255,0.35)", fontSize: 14 };
const gameCardStyle: CSSProperties = { display: "flex", gap: 10, padding: 10, marginBottom: 10, border: `1px solid ${COLOR}22`, borderRadius: 9, background: "rgba(3,5,9,0.62)" };
const coverStyle: CSSProperties = { width: 58, minWidth: 58, borderRadius: 7, backgroundSize: "cover", backgroundPosition: "center" };
const gameTitleStyle: CSSProperties = { overflowWrap: "anywhere", color: "#fff", fontWeight: 700, lineHeight: 1.15, marginBottom: 4 };
const gameMetaStyle: CSSProperties = { color: "rgba(255,255,255,0.42)", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, marginBottom: 8 };
const moveGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 };
const miniButtonStyle: CSSProperties = { padding: 7, background: "rgba(255,255,255,0.035)", border: `1px solid ${COLOR}22`, color: COLOR, borderRadius: 5, cursor: "pointer", fontSize: 8 };
const cardActionsStyle: CSSProperties = { display: "grid", gap: 6, alignSelf: "start" };
const iconButtonStyle: CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.55)", cursor: "pointer" };
