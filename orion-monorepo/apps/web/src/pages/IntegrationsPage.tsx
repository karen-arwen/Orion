import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Integration } from "@orion/types";
import { NeuralRing } from "../components/visual/NeuralRing.js";
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

const PRIMARY = "#00D4FF";

export function IntegrationsPage(): JSX.Element {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [status, setStatus] = useState<ConnectStatus>({ kind: "idle" });
  const [search, setSearch] = useSearchParams();
  const calloutStatus = search.get("status");
  const calloutReason = search.get("reason");

  const refresh = async (): Promise<void> => {
    try {
      const list = await api.listIntegrations();
      setIntegrations(list);
    } catch {
      setIntegrations([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Toast de callback OAuth: limpa a URL depois
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
  const anyStale = googleEntries.some((i) => i.status !== "connected");
  const connectionState: "all_connected" | "mixed_or_stale" | "empty" =
    allConnected
      ? "all_connected"
      : googleEntries.length === 0
      ? "empty"
      : "mixed_or_stale";

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

        {/* ── Toast de callback ── */}
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
                  onClick={() => GOOGLE_PROVIDERS.forEach((p) => void handleDisconnect(p.id))}
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
      </div>
    </div>
  );
}
