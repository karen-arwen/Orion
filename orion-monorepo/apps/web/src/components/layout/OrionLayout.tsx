import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import type { OrionMode, OrionModule, UserProfile } from "@orion/types";
import { Particles } from "../visual/Particles.js";
import { TopBar } from "../panels/TopBar.js";
import { Sidebar } from "../panels/Sidebar.js";
import { RightRail } from "../panels/RightRail.js";
import { ChatPanel } from "../panels/ChatPanel.js";
import { DashPanel } from "../panels/DashPanel.js";
import { AutoPanel } from "../panels/AutoPanel.js";
import { useUserStore } from "../../stores/user.store.js";
import { useChatStore } from "../../stores/chat.store.js";
import { useAlertsStore } from "../../stores/alerts.store.js";
import { useProjectsStore } from "../../stores/projects.store.js";

type Tab = "chat" | "dash" | "auto";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "chat", label: "◈ NEXUS CHAT" },
  { id: "dash", label: "⬡ PAINEL" },
  { id: "auto", label: "⚙ AUTOMAÇÕES" },
];

/**
 * Painel Stark do O.R.I.O.N — layout em 3 colunas:
 *   sidebar (módulos) · centro (chat/dash/auto) · right rail (alertas/status)
 */
/** Módulos que têm página dedicada — clique navega em vez de mandar mensagem. */
const MODULE_ROUTES: Partial<Record<string, string>> = {
  comms: "/m/comms",
  calendar: "/m/calendar",
  life: "/m/life",
  know: "/m/know",
  career: "/m/career",
  docs: "/m/docs",
  health: "/m/health",
  focus: "/m/focus",
  habit: "/m/habits",
  sleep: "/m/sleep",
  creative: "/m/creative",
  gaming: "/m/gaming",
};

export function OrionLayout(): JSX.Element {
  const { user } = useUser();
  const navigate = useNavigate();
  const { profile, mode, setMode, hydrate, connectedProviders, vitals, refreshIntegrations } =
    useUserStore();
  const { messages, input, loading, setInput, send, bootstrapWelcome } = useChatStore();
  const { alerts, fetch: fetchAlerts, approve, dismiss } = useAlertsStore();
  const { projects, fetch: fetchProjects } = useProjectsStore();

  const [tab, setTab] = useState<Tab>("chat");
  const [activeModule, setActiveModule] = useState<OrionModule | null>(null);

  useEffect(() => {
    if (user) {
      const fallback: UserProfile = {
        id: user.id,
        name: user.firstName ?? "Operador",
        email: user.primaryEmailAddress?.emailAddress ?? "",
        avatar: (user.firstName?.[0] ?? "O") + (user.lastName?.[0] ?? "P"),
        avatarColor: "#00D4FF",
        bio: "",
        mode: "NORMAL",
        plan: "FREE",
        timezone: "America/Sao_Paulo",
        language: "pt-BR",
        theme: { primary: "#00D4FF", secondary: "#7C3AED", accent: "#F59E0B" },
        onboardedAt: null,
        createdAt: new Date().toISOString(),
      };
      hydrate(fallback);
      bootstrapWelcome(fallback);
      fetchAlerts();
      fetchProjects();
      refreshIntegrations();
    }
  }, [user, hydrate, bootstrapWelcome, fetchAlerts, fetchProjects, refreshIntegrations]);

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-orion-bg">
        <div className="hud-label text-orion-primary text-glow text-lg">Inicializando núcleo…</div>
      </div>
    );
  }

  const color = profile.theme.primary;
  const handleSend = (override?: string): void => {
    setTab("chat");
    void send(override);
  };

  const handleModuleClick = (mod: OrionModule): void => {
    setActiveModule(mod);
    // Se o módulo tem página dedicada, navega. Senão, abre no chat com prompt contextual.
    const route = MODULE_ROUTES[mod.id];
    if (route) {
      navigate(route);
      return;
    }
    handleSend(`Ativa o módulo ${mod.label}: ${mod.sub}. Me explica o que você pode fazer.`);
  };

  const handleModeChange = (m: OrionMode): void => {
    setMode(m);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #030509 0%, #050810 50%, #030509 100%)",
        fontFamily: "'Rajdhani', sans-serif",
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Particles color={color} />

      <TopBar
        profile={profile}
        mode={mode}
        onModeChange={handleModeChange}
        connectedProviders={connectedProviders}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "210px 1fr 250px",
          overflow: "hidden",
          position: "relative",
          zIndex: 5,
        }}
      >
        <Sidebar
          profile={profile}
          activeModule={activeModule}
          onModuleClick={handleModuleClick}
          vitals={vitals}
        />

        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${color}12`,
              background: "#030509",
              flexShrink: 0,
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="hud-label"
                style={{
                  padding: "11px 18px",
                  fontSize: 10,
                  background: tab === t.id ? `${color}08` : "transparent",
                  border: "none",
                  borderBottom: tab === t.id ? `2px solid ${color}` : "2px solid transparent",
                  color: tab === t.id ? color : "rgba(255,255,255,0.16)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <ChatPanel
              profile={profile}
              messages={messages}
              loading={loading}
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
            />
          )}
          {tab === "dash" && <DashPanel profile={profile} projects={projects} />}
          {tab === "auto" && <AutoPanel profile={profile} onSendToChat={handleSend} />}
        </div>

        <RightRail
          profile={profile}
          mode={mode}
          alerts={alerts}
          projects={projects}
          onAlertApprove={(a) => {
            approve(a);
            handleSend(a.action);
          }}
          onAlertDismiss={dismiss}
          connectedProviders={connectedProviders}
        />
      </div>
    </div>
  );
}
