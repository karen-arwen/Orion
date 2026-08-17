import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { CapabilityConnector, Integration } from "@orion/types";
import { NeuralRing } from "../components/visual/NeuralRing.js";
import { StatusDot } from "../components/visual/StatusDot.js";
import { api, ApiClientError } from "../lib/api.js";

/* ═══════════════════════════════════════════════════════════════════
   Página de Integrações.

   - Lista as integrações Google (Gmail / Calendar / Drive)
   - Botão "Conectar Google" → chama /integrations/google/start,
     pega a URL, e redireciona o navegador pro consent screen
   - Depois do consent, o backend redireciona aqui de volta com
     ?status=connected — exibimos um toast e refazemos o fetch
═══════════════════════════════════════════════════════════════════ */

type ConnectStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

const GOOGLE_PROVIDERS = [
  { id: "gmail", label: "GMAIL", sub: "Ler · Buscar · Rascunhar", color: "#EA4335" },
  { id: "gcal", label: "GOOGLE CALENDAR", sub: "Eventos · Conflitos · Focus", color: "#4285F4" },
  { id: "gdrive", label: "GOOGLE DRIVE", sub: "Buscar · Ler · Analisar", color: "#0F9D58" },
] as const;


// ── Novos conectores OAuth ────────────────────────────────────────
interface OAuthConnector {
  id: string;
  label: string;
  sub: string;
  color: string;
  icon: string;
  tier: 1 | 2;
  category: string;
}

const OAUTH_CONNECTORS: OAuthConnector[] = [
  // Tier 1
  { id: "microsoft", label: "MICROSOFT", sub: "Outlook · Teams · OneDrive", color: "#00A4EF", icon: "⊞", tier: 1, category: "Produtividade" },
  { id: "github", label: "GITHUB", sub: "Repos · Issues · PRs · Actions", color: "#6E5494", icon: "◈", tier: 1, category: "Dev" },
  { id: "notion", label: "NOTION", sub: "Segundo cérebro · Wikis · Docs", color: "#FFFFFF", icon: "◻", tier: 1, category: "Produtividade" },
  { id: "slack", label: "SLACK", sub: "Canais · DMs · Histórico", color: "#4A154B", icon: "◇", tier: 1, category: "Comunicação" },
  { id: "atlassian", label: "ATLASSIAN", sub: "Jira · Confluence · Trello", color: "#0052CC", icon: "◆", tier: 1, category: "Dev / Projetos" },
  // Tier 2
  { id: "discord", label: "DISCORD", sub: "Servidores · DMs · Comunidades", color: "#5865F2", icon: "◉", tier: 2, category: "Comunicação" },
  { id: "figma", label: "FIGMA", sub: "Arquivos · Times · Protótipos", color: "#F24E1E", icon: "◑", tier: 2, category: "Design" },
  { id: "strava", label: "STRAVA", sub: "Atividades · Runs · Treinos", color: "#FC4C02", icon: "◒", tier: 2, category: "Saúde / Fitness" },
  { id: "mercadolivre", label: "MERCADO LIVRE", sub: "Compras · Vendas · Pedidos", color: "#FFE600", icon: "◓", tier: 2, category: "E-commerce" },
  { id: "linear", label: "LINEAR", sub: "Issues · Projetos · Sprints", color: "#5E6AD2", icon: "◔", tier: 2, category: "Dev / Projetos" },
  { id: "todoist", label: "TODOIST", sub: "Tarefas · Projetos · Lembretes", color: "#DB4035", icon: "◕", tier: 2, category: "Produtividade" },
  { id: "spotify", label: "SPOTIFY", sub: "Busca · Playlists · Recomendações", color: "#1DB954", icon: "◖", tier: 2, category: "Mídia" },
];

const PRIMARY = "#00D4FF";

export function IntegrationsPage(): JSX.Element {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityConnector[]>([]);
  const [status, setStatus] = useState<ConnectStatus>({ kind: "idle" });
  const [search, setSearch] = useSearchParams();
  const calloutStatus = search.get("status");
  const calloutReason = search.get("reason");
  const connectedProvider = search.get("connected");  // do OAuth universal handler
  const oauthError = search.get("error");              // erro do OAuth universal

  const refresh = async (): Promise<void> => {
    try {
      const [list, caps] = await Promise.all([api.listIntegrations(), api.listCapabilities()]);
      setIntegrations(list);
      setCapabilities(caps);
    } catch {
      setIntegrations([]);
      setCapabilities([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Toast de callback OAuth universal (?connected=provider ou ?error=...)
  useEffect(() => {
    if (connectedProvider || oauthError) {
      void refresh();
      const t = window.setTimeout(() => {
        setSearch((p) => {
          p.delete("connected");
          p.delete("error");
          p.delete("provider");
          return p;
        });
      }, 4000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [connectedProvider, oauthError, setSearch]);

  // Toast de callback OAuth Google: limpa a URL depois
  useEffect(() => {
    if (calloutStatus === "connected") {
      void refresh();
      const t = window.setTimeout(() => {
        setSearch((p) => {
          p.delete("status");
          p.delete("reason");
          return p;
        });
      }, 4000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [calloutStatus, setSearch]);

  const handleConnect = async (): Promise<void> => {
    setStatus({ kind: "loading" });
    try {
      const { url } = await api.startGoogleConnect();
      window.location.href = url;
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.code === "OAUTH_NOT_CONFIGURED"
            ? "Servidor sem credenciais Google. Veja PASSO_A_PASSO.md → Fase 4."
            : err.message
          : "Falha desconhecida ao iniciar conexão.";
      setStatus({ kind: "error", message: msg });
    }
  };

  const handleNotionConnect = async (): Promise<void> => {
    setStatus({ kind: "loading" });
    try {
      const { url } = await api.startNotionConnect();
      window.location.href = url;
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.code === "OAUTH_NOT_CONFIGURED"
            ? "Servidor sem OAuth Notion. Crie uma public connection e preencha NOTION_CLIENT_ID/SECRET."
            : err.message
          : "Falha desconhecida ao iniciar Notion.";
      setStatus({ kind: "error", message: msg });
    }
  };

  const handleDisconnect = async (provider: string): Promise<void> => {
    try {
      await api.disconnectIntegration(provider);
      await refresh();
    } catch {
      // silencioso — refresh pega o estado real
    }
  };

  const byProvider = new Map(integrations.map((i) => [i.provider, i]));
  // ── Estado da conexão Google ────────────────────────────────────
  // - all_connected: todas as 3 integrações ativas → mostra DESCONECTAR
  // - mixed_or_stale: tem entry mas algumas revoked/expired → mostra RECONECTAR
  // - empty: sem nenhuma → mostra + CONECTAR GOOGLE
  const googleEntries = GOOGLE_PROVIDERS.map((p) => byProvider.get(p.id)).filter(
    (i): i is Integration => Boolean(i),
  );
  const allConnected =
    googleEntries.length === GOOGLE_PROVIDERS.length &&
    googleEntries.every((i) => i.status === "connected");
  const anyConnected = googleEntries.some((i) => i.status === "connected");
  const anyStale = googleEntries.some((i) => i.status !== "connected");
  const connectionState: "all_connected" | "mixed_or_stale" | "empty" =
    allConnected
      ? "all_connected"
      : googleEntries.length === 0
      ? "empty"
      : "mixed_or_stale";


  const connectOAuth = (provider: string): void => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
    window.location.href = `${apiUrl}/v1/integrations/oauth/${provider}/connect?returnTo=/integrations`;
  };

  const disconnectOAuth = async (provider: string): Promise<void> => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/${provider}`, {
        method: "DELETE",
        credentials: "include",
      });
      await refresh();
    } catch { /* noop */ }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: "linear-gradient(135deg, #030509 0%, #050810 50%, #030509 100%)",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <NeuralRing color={PRIMARY} size={48} />
          <div style={{ flex: 1 }}>
            <div
              className="hud-label text-glow"
              style={{ fontSize: 18, color: PRIMARY, letterSpacing: "0.25em" }}
            >
              INTEGRAÇÕES
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              Conecte suas contas — o O.R.I.O.N. renova tokens sozinho.
            </div>
          </div>
          <Link
            to="/"
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              border: "1px solid rgba(0,212,255,0.25)",
              color: "rgba(0,212,255,0.7)",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            ← VOLTAR
          </Link>
        </div>

        {/* ── Toast OAuth universal ── */}
        {connectedProvider && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 20,
              background: "linear-gradient(135deg, rgba(16,185,129,0.12), transparent)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 8,
              color: "#10B981",
              fontSize: 12,
            }}
          >
            ✓ {connectedProvider.toUpperCase()} conectado com sucesso. Tokens serão renovados automaticamente.
          </div>
        )}
        {oauthError && !connectedProvider && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 20,
              background: "linear-gradient(135deg, rgba(239,68,68,0.12), transparent)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 8,
              color: "#EF4444",
              fontSize: 12,
            }}
          >
            ✗ Falha OAuth: {oauthError.replace(/_/g, " ")}
          </div>
        )}

        {/* ── Toast de callback Google ── */}
        {calloutStatus === "connected" && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 20,
              background: "linear-gradient(135deg, rgba(16,185,129,0.12), transparent)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 8,
              color: "#10B981",
              fontSize: 12,
            }}
          >
            ✓ Google conectado com sucesso. Tokens vão se renovar automaticamente.
          </div>
        )}
        {calloutStatus === "denied" && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 20,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
            }}
          >
            Conexão cancelada{calloutReason ? ` (${calloutReason})` : ""}. Pode tentar de novo.
          </div>
        )}
        {calloutStatus === "error" && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 20,
              background: "linear-gradient(135deg, rgba(239,68,68,0.12), transparent)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 8,
              color: "#EF4444",
              fontSize: 12,
            }}
          >
            ✗ Falha ao conectar{calloutReason ? `: ${calloutReason}` : "."}
          </div>
        )}

        {/* ── Card principal: Google ── */}
        <div
          style={{
            padding: 24,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${anyConnected ? "rgba(16,185,129,0.25)" : "rgba(0,212,255,0.2)"}`,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              G
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                Google Workspace
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                Um consent → Gmail, Calendar e Drive de uma vez
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(connectionState === "empty" || connectionState === "mixed_or_stale") && (
                <button
                  onClick={handleConnect}
                  disabled={status.kind === "loading"}
                  className="hud-label"
                  style={{
                    padding: "10px 18px",
                    fontSize: 10,
                    background:
                      status.kind === "loading"
                        ? "rgba(255,255,255,0.05)"
                        : `linear-gradient(135deg, ${PRIMARY}25, rgba(124,58,237,0.15))`,
                    border: `1px solid ${status.kind === "loading" ? "rgba(255,255,255,0.1)" : PRIMARY + "55"}`,
                    color: status.kind === "loading" ? "rgba(255,255,255,0.3)" : PRIMARY,
                    borderRadius: 6,
                    cursor: status.kind === "loading" ? "not-allowed" : "pointer",
                    boxShadow: status.kind === "loading" ? "none" : `0 0 12px ${PRIMARY}20`,
                  }}
                >
                  {status.kind === "loading"
                    ? "ABRINDO…"
                    : connectionState === "mixed_or_stale"
                    ? "↻ RECONECTAR"
                    : "+ CONECTAR GOOGLE"}
                </button>
              )}
              {(connectionState === "all_connected" || connectionState === "mixed_or_stale") && (
                <button
                  onClick={() => {
                    void Promise.all(GOOGLE_PROVIDERS.map((p) => api.disconnectIntegration(p.id)))
                      .then(refresh)
                      .catch(refresh);
                  }}
                  className="hud-label"
                  style={{
                    padding: "8px 14px",
                    fontSize: 9,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.4)",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  DESCONECTAR
                </button>
              )}
            </div>
          </div>

          {status.kind === "error" && (
            <div
              style={{
                fontSize: 11,
                color: "#EF4444",
                padding: "8px 12px",
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {status.message}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {GOOGLE_PROVIDERS.map((p) => {
              const integ = byProvider.get(p.id);
              const connected = integ?.status === "connected";
              const stale = integ?.status === "expired" || integ?.status === "revoked";
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 8,
                  }}
                >
                  <StatusDot
                    active={connected}
                    color={connected ? "#10B981" : stale ? "#F59E0B" : "#64748B"}
                    pulse={connected}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="hud-label"
                      style={{ fontSize: 10, color: connected ? "#10B981" : "rgba(255,255,255,0.4)" }}
                    >
                      {p.label}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>
                      {p.sub}
                    </div>
                  </div>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 9,
                      color: connected ? "#10B981" : stale ? "#F59E0B" : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {connected ? "CONECTADO" : stale ? "RECONECTAR" : "OFF"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.25)",
            textAlign: "center",
            lineHeight: 1.8,
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          OAuth 2.0 · Refresh automático · Tokens criptografados em repouso
          <br />
          Você autoriza uma vez. O O.R.I.O.N. cuida do resto.
        </div>
        <section className="integration-capabilities">
          <div style={{ marginBottom: 12 }}>
            <div className="hud-label" style={{ color: PRIMARY, fontSize: 11 }}>
              CAPABILITY REGISTRY
            </div>
            <p>O que o Orion pode acessar hoje, o que ja tem credencial e o que ainda precisa configurar.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map((cap) => {
              const statusColor =
                cap.status === "connected"
                  ? "#10B981"
                  : cap.status === "configured"
                  ? "#F59E0B"
                  : cap.status === "planned"
                  ? "#64748B"
                  : "#EF4444";
              return (
                <article key={cap.provider} className="capability-card" style={{ borderColor: `${statusColor}35` }}>
                  <div className="capability-card-head">
                    <div>
                      <span className="hud-label" style={{ color: statusColor, fontSize: 8 }}>
                        {cap.status}
                      </span>
                      <strong>{cap.label}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {cap.provider === "notion" && cap.status !== "connected" && (
                        <button
                          type="button"
                          onClick={() => void handleNotionConnect()}
                          className="orion-link-button"
                          disabled={status.kind === "loading"}
                        >
                          CONECTAR
                        </button>
                      )}
                      {cap.status === "connected" && cap.provider === "notion" && (
                        <button
                          type="button"
                          onClick={() => void handleDisconnect("notion").then(refresh)}
                          className="orion-link-button"
                        >
                          DESCONECTAR
                        </button>
                      )}
                      <a href={cap.docsUrl} target="_blank" rel="noreferrer" className="orion-link-button">
                        DOCS
                      </a>
                    </div>
                  </div>
                  <p>{cap.notes}</p>
                  <div className="capability-actions">
                    {cap.actions.slice(0, 3).map((action) => (
                      <span key={action.id} title={action.requiresDecision ? "Passa pela Decision Inbox" : "Leitura segura"}>
                        {action.kind} · {action.label}
                      </span>
                    ))}
                  </div>
                  <small>
                    Setup: {cap.setupKind} · {cap.envVars.length > 0 ? cap.envVars.join(", ") : "sem env"}
                  </small>
                </article>
              );
            })}
          </div>
        </section>
        {/* ── Novos Conectores OAuth ──────────────────────────────── */}
        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "#4B5563", letterSpacing: "0.15em", marginBottom: "16px" }}>
            CONECTORES OAUTH · {OAUTH_CONNECTORS.length} DISPONÍVEIS
          </h2>
          {(["Produtividade", "Dev", "Dev / Projetos", "Comunicação", "Design", "Saúde / Fitness", "E-commerce", "Mídia"] as const).map((category) => {
            const group = OAUTH_CONNECTORS.filter((c) => c.category === category);
            if (group.length === 0) return null;
            return (
              <div key={category} style={{ marginBottom: "20px" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.12em", marginBottom: "8px" }}>
                  {category.toUpperCase()}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
                  {group.map((conn) => {
                    const integration = integrations.find((i) => i.provider === conn.id);
                    const isConnected = integration?.status === "connected";
                    return (
                      <div key={conn.id} style={{
                        background: "#0a0f1a",
                        border: `1px solid ${isConnected ? conn.color + "40" : "#1F2937"}`,
                        borderLeft: `3px solid ${isConnected ? conn.color : "#1F2937"}`,
                        borderRadius: "4px",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "14px", color: conn.color }}>{conn.icon}</span>
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "#E2E8F0", letterSpacing: "0.06em" }}>
                              {conn.label}
                            </span>
                          </div>
                          {isConnected && (
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#10B981" }}>●</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.04em" }}>
                          {conn.sub}
                        </div>
                        <button
                          onClick={() => isConnected ? disconnectOAuth(conn.id) : connectOAuth(conn.id)}
                          style={{
                            marginTop: "4px",
                            padding: "4px 10px",
                            border: `1px solid ${isConnected ? "#EF444440" : conn.color + "40"}`,
                            borderRadius: "2px",
                            background: isConnected ? "#EF444408" : `${conn.color}08`,
                            color: isConnected ? "#EF4444" : conn.color,
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: "9px",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                          }}
                        >
                          {isConnected ? "DESCONECTAR" : "CONECTAR"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
