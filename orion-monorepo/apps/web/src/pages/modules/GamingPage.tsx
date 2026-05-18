import { useState } from "react";
import type { GameEntry, GameStatus } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useAddGame,
  useDeleteGame,
  useGames,
  useSearchGames,
  useUpdateGame,
} from "../../hooks/modules/useGaming.js";

const PRIMARY = "#7C3AED";

const SHELVES: Array<{ id: GameStatus; label: string; color: string }> = [
  { id: "wishlist", label: "QUER JOGAR", color: "#F59E0B" },
  { id: "playing", label: "JOGANDO", color: "#00D4FF" },
  { id: "finished", label: "ZEROU", color: "#10B981" },
  { id: "dropped", label: "DROPPED", color: "#64748B" },
];

export function GamingPage(): JSX.Element {
  const { data: games, isLoading } = useGames();
  const add = useAddGame();
  const update = useUpdateGame();
  const remove = useDeleteGame();
  const search = useSearchGames();

  const [query, setQuery] = useState("");

  const handleSearch = (): void => {
    if (!query.trim()) return;
    search.mutate(query.trim());
  };

  const shelfGames = (status: GameStatus): GameEntry[] =>
    (games ?? []).filter((g) => g.status === status);

  return (
    <ModuleShell icon="▣" label="GAMING" sub="Shelf · Wishlist · Companion" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Busca RAWG */}
        <div
          style={{
            padding: 14,
            marginBottom: 18,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${PRIMARY}30`,
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Buscar jogo no RAWG…"
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
              {search.isPending ? "BUSCANDO…" : "🔍 BUSCAR"}
            </button>
          </div>

          {/* Resultados busca */}
          {search.data && search.data.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {search.data.map((g) => (
                <div
                  key={g.rawgId}
                  style={{
                    padding: 10,
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
                      alt={g.title}
                      style={{ width: 60, height: 36, objectFit: "cover", borderRadius: 4 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                      {g.title}{g.releasedAt && ` (${g.releasedAt.slice(0, 4)})`}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "'Share Tech Mono', monospace",
                      }}
                    >
                      {g.platform} · {g.genre} · ★{g.rating.toFixed(1)}
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

        {isLoading && (
          <div
            className="hud-label"
            style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}
          >
            ◌ carregando shelf…
          </div>
        )}

        {games && games.length === 0 && !isLoading && (
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
            Sua shelf tá vazia. Busca um jogo acima pra adicionar.
          </div>
        )}

        {/* Shelves */}
        {games && games.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {SHELVES.map((shelf) => {
              const items = shelfGames(shelf.id);
              if (items.length === 0) return null;
              return (
                <div
                  key={shelf.id}
                  style={{
                    padding: 12,
                    background: "rgba(255,255,255,0.015)",
                    border: `1px solid ${shelf.color}30`,
                    borderRadius: 10,
                  }}
                >
                  <div
                    className="hud-label"
                    style={{
                      fontSize: 10,
                      color: shelf.color,
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: `1px solid ${shelf.color}22`,
                    }}
                  >
                    {shelf.label} · {items.length}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          padding: 8,
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${shelf.color}25`,
                          borderRadius: 6,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        {g.coverUrl && (
                          <img
                            src={g.coverUrl}
                            alt={g.title}
                            style={{ width: 40, height: 24, objectFit: "cover", borderRadius: 3 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                            {g.title}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: "rgba(255,255,255,0.35)",
                              fontFamily: "'Share Tech Mono', monospace",
                            }}
                          >
                            {g.platform ?? "—"}
                          </div>
                        </div>
                        <select
                          value={g.status}
                          onChange={(e) =>
                            update.mutate({ id: g.id, patch: { status: e.target.value as GameStatus } })
                          }
                          style={{
                            padding: "3px 5px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 3,
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 9,
                            fontFamily: "'Share Tech Mono', monospace",
                          }}
                        >
                          {SHELVES.map((s) => (
                            <option key={s.id} value={s.id} style={{ background: "#0A0F1A" }}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => remove.mutate(g.id)}
                          style={{
                            padding: "3px 6px",
                            fontSize: 10,
                            background: "transparent",
                            border: "1px solid rgba(239,68,68,0.25)",
                            color: "rgba(239,68,68,0.6)",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
