import { useState } from "react";
import type { GameEntry, GameStatus } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useAddGame,
  useDeleteGame,
  useGames,
  useSearchGames,
  useUpdateGame,
} from "../../hooks/modules/useGaming.js";

const PRIMARY = "#7C3AED";

const STATUS_META: Record<GameStatus, { label: string; color: string; icon: string }> = {
  wishlist: { label: "QUER JOGAR", color: "#F59E0B", icon: "◌" },
  playing: { label: "JOGANDO", color: "#00D4FF", icon: "▷" },
  finished: { label: "ZEROU", color: "#10B981", icon: "✓" },
  dropped: { label: "DROPPED", color: "#64748B", icon: "×" },
  paused: { label: "PAUSADO", color: "#7C3AED", icon: "⏸" },
};

const ALL_STATUSES: GameStatus[] = ["wishlist", "playing", "finished", "dropped", "paused"];

export function GamingPage(): JSX.Element {
  const { data: games, isLoading } = useGames();
  const add = useAddGame();
  const update = useUpdateGame();
  const remove = useDeleteGame();
  const search = useSearchGames();

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<GameStatus | "all">("all");
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearch = (): void => {
    if (!query.trim()) return;
    search.mutate(query.trim());
  };

  const filtered =
    activeFilter === "all" ? games ?? [] : (games ?? []).filter((g) => g.status === activeFilter);

  // Stats
  const stats = {
    total: games?.length ?? 0,
    wishlist: games?.filter((g) => g.status === "wishlist").length ?? 0,
    playing: games?.filter((g) => g.status === "playing").length ?? 0,
    finished: games?.filter((g) => g.status === "finished").length ?? 0,
    totalHours: (games ?? []).reduce((sum, g) => sum + g.hoursPlayed, 0),
  };

  return (
    <ModuleShell icon="▣" label="GAMING" sub="Shelf · Wishlist · Companion" color={PRIMARY}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* ── Stats grid ── */}
        <div
          className="gaming-stats-grid"
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <StatCard label="TOTAL" value={stats.total} color={PRIMARY} icon="▣" />
          <StatCard
            label="QUER JOGAR"
            value={stats.wishlist}
            color={STATUS_META.wishlist.color}
            icon="◌"
          />
          <StatCard
            label="JOGANDO"
            value={stats.playing}
            color={STATUS_META.playing.color}
            icon="▷"
          />
          <StatCard
            label="HORAS"
            value={Math.round(stats.totalHours)}
            color="#10B981"
            icon="⌚"
          />
        </div>

        {/* ── Action bar ── */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setSearchOpen((p) => !p)}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: searchOpen ? `${PRIMARY}25` : "rgba(255,255,255,0.04)",
              border: `1px solid ${searchOpen ? PRIMARY : "rgba(255,255,255,0.1)"}`,
              color: searchOpen ? PRIMARY : "rgba(255,255,255,0.7)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {searchOpen ? "× FECHAR BUSCA" : "🔍 ADICIONAR JOGO"}
          </button>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
            <FilterChip
              label="TUDO"
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
              count={stats.total}
              color="rgba(255,255,255,0.5)"
            />
            {ALL_STATUSES.map((s) => {
              const meta = STATUS_META[s];
              const count = (games ?? []).filter((g) => g.status === s).length;
              if (count === 0 && activeFilter !== s) return null;
              return (
                <FilterChip
                  key={s}
                  label={meta.label}
                  active={activeFilter === s}
                  onClick={() => setActiveFilter(s)}
                  count={count}
                  color={meta.color}
                />
              );
            })}
          </div>
        </div>

        {/* ── Search panel ── */}
        {searchOpen && (
          <div
            style={{
              padding: 14,
              marginBottom: 16,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${PRIMARY}30`,
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Nome do jogo (RAWG)…"
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif",
                  outline: "none",
                }}
                autoFocus
              />
              <button
                onClick={handleSearch}
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
                {search.isPending ? "…" : "BUSCAR"}
              </button>
            </div>
            {search.data && search.data.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {search.data.map((g) => (
                  <div
                    key={g.rawgId}
                    style={{
                      padding: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(124,58,237,0.2)",
                      borderRadius: 6,
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    {g.coverUrl && (
                      <img
                        src={g.coverUrl}
                        alt=""
                        style={{ width: 60, height: 36, objectFit: "cover", borderRadius: 4 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.9)",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {g.title}
                        {g.releasedAt && (
                          <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
                            {" "}
                            ({g.releasedAt.slice(0, 4)})
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.4)",
                          fontFamily: "'Share Tech Mono', monospace",
                        }}
                      >
                        ★{g.rating.toFixed(1)} · {g.platform} · {g.genre}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        add.mutate({
                          title: g.title,
                          rawgId: g.rawgId,
                          platform: g.platform,
                          genre: g.genre,
                          coverUrl: g.coverUrl ?? undefined,
                          releasedAt: g.releasedAt ?? undefined,
                          status: "wishlist",
                        })
                      }
                      className="hud-label"
                      style={{
                        padding: "4px 10px",
                        fontSize: 9,
                        background: `${PRIMARY}25`,
                        border: `1px solid ${PRIMARY}55`,
                        color: PRIMARY,
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      + WISHLIST
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div
            className="hud-label"
            style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}
          >
            ◌ carregando shelf…
          </div>
        )}

        {filtered.length === 0 && !isLoading && (
          <div
            style={{
              padding: 30,
              background: "rgba(255,255,255,0.015)",
              border: "1px dashed rgba(124,58,237,0.3)",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {activeFilter === "all"
              ? "Sua shelf tá vazia. Clica em 🔍 ADICIONAR JOGO acima."
              : `Nenhum jogo em "${STATUS_META[activeFilter as GameStatus]?.label}".`}
          </div>
        )}

        {/* ── Library grid ── */}
        {filtered.length > 0 && (
          <div
            className="gaming-library-grid"
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {filtered.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                onChangeStatus={(status) => update.mutate({ id: g.id, patch: { status } })}
                onUpdateRating={(rating) => update.mutate({ id: g.id, patch: { rating } })}
                onUpdateHours={(hours) => update.mutate({ id: g.id, patch: { hoursPlayed: hours } })}
                onDelete={() => remove.mutate(g.id)}
              />
            ))}
          </div>
        )}
      </div>
      <ModuleChat
        module="gaming"
        label="GAMING"
        color={PRIMARY}
        welcome="Me diz o que voce gosta de jogar e eu recomendo jogos, organizo sua backlog e acompanho seu progresso."
        suggestions={["Recomendar jogos", "Backlog organizada", "O que jogar hoje?", "Lancamentos"]}
      />
    </ModuleShell>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${color}25`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14, color }}>{icon}</span>
        <span
          className="hud-label"
          style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 26,
          fontFamily: "'Share Tech Mono', monospace",
          color,
          fontWeight: 700,
          textShadow: `0 0 10px ${color}60`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  color: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="hud-label"
      style={{
        padding: "5px 11px",
        fontSize: 9,
        background: active ? `${color}25` : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "rgba(255,255,255,0.5)",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {label}
      <span
        style={{
          padding: "1px 5px",
          fontSize: 9,
          background: active ? `${color}40` : "rgba(255,255,255,0.05)",
          borderRadius: 3,
          color: active ? color : "rgba(255,255,255,0.4)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

interface GameCardProps {
  game: GameEntry;
  onChangeStatus: (s: GameStatus) => void;
  onUpdateRating: (r: number) => void;
  onUpdateHours: (h: number) => void;
  onDelete: () => void;
}

function GameCard({ game, onChangeStatus, onUpdateRating, onUpdateHours, onDelete }: GameCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[game.status];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${statusMeta.color}30`,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Cover */}
      <div
        style={{
          width: "100%",
          height: 120,
          background: game.coverUrl
            ? `linear-gradient(180deg, transparent 0%, rgba(3,5,9,0.85) 100%), url(${game.coverUrl}) center/cover`
            : `linear-gradient(135deg, ${statusMeta.color}25, rgba(255,255,255,0.02))`,
          position: "relative",
        }}
      >
        {/* Status badge */}
        <div
          className="hud-label"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "3px 8px",
            fontSize: 8,
            background: `${statusMeta.color}40`,
            border: `1px solid ${statusMeta.color}`,
            color: "#fff",
            borderRadius: 3,
            backdropFilter: "blur(8px)",
            textShadow: `0 0 6px ${statusMeta.color}`,
          }}
        >
          {statusMeta.icon} {statusMeta.label}
        </div>

        {!game.coverUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              color: `${statusMeta.color}40`,
            }}
          >
            ▣
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            marginBottom: 4,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {game.title}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "'Share Tech Mono', monospace",
            marginBottom: 10,
          }}
        >
          {game.platform ?? "—"}
          {game.releasedAt && ` · ${game.releasedAt.slice(0, 4)}`}
        </div>

        {/* Rating stars */}
        <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onUpdateRating(n)}
              style={{
                background: "transparent",
                border: "none",
                color: (game.rating ?? 0) >= n ? "#F59E0B" : "rgba(255,255,255,0.15)",
                fontSize: 14,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ★
            </button>
          ))}
        </div>

        {/* Hours */}
        {(game.status === "playing" || game.status === "finished" || game.hoursPlayed > 0) && (
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "'Share Tech Mono', monospace",
              marginBottom: 8,
            }}
          >
            ⌚ {game.hoursPlayed.toFixed(1)}h jogadas
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, marginTop: "auto" }}>
          <select
            value={game.status}
            onChange={(e) => onChangeStatus(e.target.value as GameStatus)}
            style={{
              flex: 1,
              padding: "5px 7px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${statusMeta.color}40`,
              borderRadius: 4,
              color: statusMeta.color,
              fontSize: 9,
              fontFamily: "'Share Tech Mono', monospace",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s} style={{ background: "#0A0F1A", color: "#fff" }}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setExpanded((p) => !p)}
            style={{
              padding: "5px 8px",
              fontSize: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              borderRadius: 4,
              cursor: "pointer",
            }}
            title="Editar horas"
          >
            ⋯
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: "5px 7px",
              fontSize: 10,
              background: "transparent",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "rgba(239,68,68,0.6)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {expanded && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 4,
            }}
          >
            <label
              className="hud-label"
              style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 3 }}
            >
              HORAS JOGADAS
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={game.hoursPlayed}
              onChange={(e) => onUpdateHours(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%",
                padding: "4px 6px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 3,
                color: "#fff",
                fontSize: 11,
                fontFamily: "'Share Tech Mono', monospace",
                outline: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
