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
import { MissionControlPanel } from "../panels/MissionControlPanel.js";
import { AutoPanel } from "../panels/AutoPanel.js";
import { ConversationThreads } from "../panels/ConversationThreads.js";
import { CommandPalette, modeCommandLabel, type CommandItem } from "../command/CommandPalette.js";
import { NotificationCenter } from "../notifications/NotificationCenter.js";
import { InstallPrompt } from "../visual/InstallPrompt.js";
import { OnboardingTour, shouldShowTour } from "../visual/OnboardingTour.js";
import { useUserStore } from "../../stores/user.store.js";
import { useChatStore } from "../../stores/chat.store.js";
import { useAlertsStore } from "../../stores/alerts.store.js";
import { useProjectsStore } from "../../stores/projects.store.js";
import { useApproveDecision, useDecisions, useDismissDecision, useExecutedDecisions, useSyncDecisions } from "../../hooks/useDecisions.js";

type Tab = "chat" | "dash" | "mission" | "auto";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "chat", label: "◈ NEXUS CHAT" },
  { id: "dash", label: "⬡ PAINEL" },
  { id: "auto", label: "⚙ AUTOMAÇÕES" },
];

/**
 * Painel Stark do O.R.I.O.N — layout em 3 colunas:
 *   sidebar (módulos) · centro (chat/dash/auto) · right rail (alertas/status)
 */
/**
 * Modulos que tem pagina dedicada — clique navega em vez de mandar pro chat.
 *
 * IMPORTANTE: os paths aqui DEVEM bater com:
 *   - apps/api/src/routes/index.ts  (backend REST)
 *   - apps/web/src/App.tsx          (React Router)
 *
 * Padrao: usar o nome do backend (agenda, habits, security, media, language)
 * mesmo quando o id interno do modulo no constants.ts e diferente (calendar,
 * habit, sec, entert, lang). Backend e fonte da verdade.
 */
const MODULE_ROUTES: Partial<Record<string, string>> = {
  comms: "/m/comms",
  calendar: "/m/agenda",
  life: "/m/life",
  know: "/m/know",
  career: "/m/career",
  finance: "/m/finance",
  docs: "/m/docs",
  health: "/m/health",
  focus: "/m/focus",
  habit: "/m/habits",
  creative: "/m/creative",
  entert: "/m/media",
  gaming: "/m/gaming",
  news: "/m/news",
  sleep: "/m/sleep",
  shop: "/m/shop",
  travel: "/m/travel",
  lang: "/m/language",
  whatif: "/m/whatif",
  chef: "/m/chef",
  mindset: "/m/mindset",
  social: "/m/social",
  sec: "/m/security",
  dev: "/m/dev",
  autonomy: "/autonomy",
  behavioral: "/profile/behavioral",
  quest: "/m/quest",
  routines: "/m/routines",
  journal: "/m/journal",
  projects: "/m/projects",
  dashboard: "/dashboard",
};

/** Lista canonica usada pelo Command Palette. Mesma ordem do MODULE_ROUTES. */
const ROUTED_MODULES: Array<{ id: string; label: string; detail: string; route: string }> = [
  { id: "dashboard", label: "DASHBOARD", detail: "Painel inteligente do dia", route: "/dashboard" },
  { id: "comms",    label: "COMMS",          detail: "Email, inbox e comunicacao",       route: "/m/comms" },
  { id: "calendar", label: "AGENDA",         detail: "Eventos, conflitos e foco",        route: "/m/agenda" },
  { id: "life",     label: "LIFE OS",        detail: "Tarefas, energia e planner",       route: "/m/life" },
  { id: "know",     label: "CONHECIMENTO",   detail: "Tutor, expert, dev",               route: "/m/know" },
  { id: "career",   label: "CARREIRA",       detail: "Coach, portfolio, vagas",          route: "/m/career" },
  { id: "finance",  label: "CFO PESSOAL",    detail: "Gastos, metas, alertas",           route: "/m/finance" },
  { id: "docs",     label: "DOCUMENTOS",     detail: "Drive, analise e resumo",          route: "/m/docs" },
  { id: "health",   label: "SAUDE",          detail: "Energia, pausas e ritmo",          route: "/m/health" },
  { id: "focus",    label: "FOCO",           detail: "Pomodoro, flow, bloqueio",         route: "/m/focus" },
  { id: "habit",    label: "HABITOS",        detail: "Streak, tracking, coach",          route: "/m/habits" },
  { id: "sleep",    label: "SLEEP",          detail: "Sono e recuperacao",               route: "/m/sleep" },
  { id: "creative", label: "CRIACAO",        detail: "Ideias, nomes, conteudo",          route: "/m/creative" },
  { id: "entert",   label: "MIDIA",          detail: "Filmes, series, animes e gosto",   route: "/m/media" },
  { id: "gaming",   label: "GAMING",         detail: "Biblioteca e wishlist",            route: "/m/gaming" },
  { id: "chef",     label: "CHEF",           detail: "Receitas e compras",               route: "/m/chef" },
  { id: "travel",   label: "TRAVEL",         detail: "Roteiros com IA",                  route: "/m/travel" },
  { id: "news",     label: "RADAR",          detail: "Vagas, noticias e oportunidades",  route: "/m/news" },
  { id: "social",   label: "SOCIAL",         detail: "CRM pessoal",                      route: "/m/social" },
  { id: "shop",     label: "COMPRAS",        detail: "Wishlist e preco alvo",            route: "/m/shop" },
  { id: "lang",     label: "IDIOMAS",        detail: "Pratica e correcao",               route: "/m/language" },
  { id: "whatif",   label: "WHAT-IF",        detail: "Simulador de cenarios",            route: "/m/whatif" },
  { id: "mindset",  label: "MINDSET",        detail: "Check-in e padroes",               route: "/m/mindset" },
  { id: "sec",      label: "SEGURANCA",      detail: "Senhas, privacidade, guard",       route: "/m/security" },
  { id: "dev",      label: "DEV EXECUTOR",   detail: "Workspace, preview e escrita aprovada", route: "/m/dev" },
  { id: "autonomy", label: "AUTONOMY CORE",  detail: "Niveis de autonomia por modulo",     route: "/autonomy" },
  { id: "behavioral", label: "PERFIL ADAPTATIVO", detail: "Como o ORION aprendeu seu estilo", route: "/profile/behavioral" },
  { id: "quest",      label: "NEXUS / XP",        detail: "Conquistas, missoes e progresso",    route: "/m/quest" },
  { id: "routines",   label: "ROTINAS",           detail: "Sequencias diarias e streaks",       route: "/m/routines" },
  { id: "journal",    label: "DIARIO",            detail: "Entrada guiada e analise ORION",     route: "/m/journal" },
  { id: "projects",   label: "PROJETOS",          detail: "Milestones, timeline e deteccao de parado", route: "/m/projects" },
];

export function OrionLayout(): JSX.Element {
  const { user } = useUser();
  const navigate = useNavigate();
  const { profile, mode, setMode, hydrate, connectedProviders, vitals, refreshIntegrations } =
    useUserStore();
  const { messages, input, loading, activeTools, setInput, send, bootstrapWelcome, loadConversation, conversationId } = useChatStore();
  const { alerts, fetch: fetchAlerts, scan: scanAlerts, approve, dismiss } = useAlertsStore();
  const { projects, fetch: fetchProjects } = useProjectsStore();
  const decisions = useDecisions();
  const executedDecisions = useExecutedDecisions();
  const syncDecisions = useSyncDecisions();
  const approveDecision = useApproveDecision();
  const dismissDecision = useDismissDecision();

  const [tab, setTab] = useState<Tab>("chat");
  const [activeModule, setActiveModule] = useState<OrionModule | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
      // Show tour after 2s if first visit
      if (shouldShowTour()) {
        setTimeout(() => setShowTour(true), 2000);
      }
    }
  }, [user, hydrate, bootstrapWelcome, fetchAlerts, fetchProjects, refreshIntegrations]);

  // Ctrl+K command palette — must be before early return to maintain hook order
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const commandItems: CommandItem[] = [
    ...ROUTED_MODULES.map((mod) => ({
      id: `module-${mod.id}`,
      label: mod.label,
      detail: mod.detail,
      group: "modulo" as const,
      run: () => navigate(mod.route),
    })),
    {
      id: "chat-morning",
      label: "Gerar briefing",
      detail: "Pedir um resumo do dia com agenda, riscos e foco",
      group: "acao",
      run: () => handleSend("Gere meu briefing de hoje com agenda, alertas, prioridade e proximo passo."),
    },
    {
      id: "chat-next",
      label: "Decidir proxima acao",
      detail: "O Orion escolhe a proxima tarefa com base em energia e prioridade",
      group: "acao",
      run: () => handleSend("Analise meu contexto atual e decida a proxima acao mais inteligente."),
    },
    {
      id: "sync-action-queue",
      label: "Sincronizar Action Queue",
      detail: "Transformar alertas ativos em decisoes executaveis",
      group: "acao",
      run: () => {
        void syncDecisions.mutateAsync().then(() => setNotificationsOpen(true));
      },
    },
    {
      id: "open-integrations",
      label: "Integracoes",
      detail: "Reconectar Gmail, Calendar e Drive",
      group: "sistema",
      run: () => navigate("/integrations"),
    },
    // ── Quick Actions: atalhos diretos pra funcoes de cada modulo ──
    {
      id: "qa-add-expense",
      label: "Registrar gasto",
      detail: "Adicionar despesa rapida no CFO",
      group: "acao",
      run: () => { navigate("/m/finance"); },
    },
    {
      id: "qa-add-task",
      label: "Criar tarefa",
      detail: "Nova tarefa no Life OS",
      group: "acao",
      run: () => { navigate("/m/life"); },
    },
    {
      id: "qa-log-energy",
      label: "Registrar energia",
      detail: "Check-in rapido de energia no Saude",
      group: "acao",
      run: () => { navigate("/m/health"); },
    },
    {
      id: "qa-focus",
      label: "Iniciar foco",
      detail: "Comecar sessao de concentracao",
      group: "acao",
      run: () => { navigate("/m/focus"); },
    },
    {
      id: "qa-habits",
      label: "Marcar habito",
      detail: "Registrar habito concluido",
      group: "acao",
      run: () => { navigate("/m/habits"); },
    },
    {
      id: "qa-sleep",
      label: "Registrar sono",
      detail: "Log de sono rapido",
      group: "acao",
      run: () => { navigate("/m/health"); },
    },
    {
      id: "qa-practice",
      label: "Praticar idioma",
      detail: "Sessao de pratica de idioma",
      group: "acao",
      run: () => { navigate("/m/language"); },
    },
    {
      id: "qa-whatif",
      label: "Simular cenario",
      detail: "What-If: testar decisoes",
      group: "acao",
      run: () => { navigate("/m/whatif"); },
    },
    {
      id: "qa-recipe",
      label: "Buscar receita",
      detail: "Chef: sugerir o que cozinhar",
      group: "acao",
      run: () => { navigate("/m/chef"); },
    },
    {
      id: "qa-analyze-week",
      label: "Analisar minha semana",
      detail: "ORION analisa padroes da semana",
      group: "acao",
      run: () => handleSend("Analise minha semana: energia, habitos, tarefas, sono. Me de um panorama completo com insights e proximos passos."),
    },
    {
      id: "qa-plan-tomorrow",
      label: "Planejar amanha",
      detail: "Montar plano otimizado pro dia seguinte",
      group: "acao",
      run: () => handleSend("Planeje meu amanha: olhe minha agenda, tarefas pendentes, energia recente. Monte um plano otimizado com blocos de foco."),
    },
    {
      id: "qa-coach-session",
      label: "Sessao de coaching",
      detail: "ORION como coach pessoal",
      group: "acao",
      run: () => handleSend("Quero uma sessao de coaching rapida. Analise meu momento atual — carreira, projetos, habitos, energia — e me de 3 acoes concretas pra esta semana."),
    },
    ...(["SILENCIOSO", "NORMAL", "STARK"] as OrionMode[]).map((m) => ({
      id: `mode-${m}`,
      label: modeCommandLabel(m),
      detail: "Alterar comportamento proativo do Orion",
      group: "modo" as const,
      run: () => handleModeChange(m),
    })),
  ];

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
        alertCount={alerts.length + (decisions.data?.length ?? 0)}
        onCommandOpen={() => setCommandOpen(true)}
        onNotificationsOpen={() => setNotificationsOpen(true)}
      />

      <div
        className="orion-main-grid"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "210px 1fr 250px",
          overflow: "hidden",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* Sidebar - desktop: inline, mobile: drawer */}
        <div className="orion-sidebar">
          <Sidebar
            profile={profile}
            activeModule={activeModule}
            onModuleClick={handleModuleClick}
            vitals={vitals}
          />
        </div>
        {sidebarOpen && (
          <>
            <div className="orion-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            <div className="orion-sidebar-drawer open">
              <Sidebar
                profile={profile}
                activeModule={activeModule}
                onModuleClick={(mod) => { handleModuleClick(mod); setSidebarOpen(false); }}
                vitals={vitals}
              />
            </div>
          </>
        )}

        <div className="orion-center-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${color}12`,
              background: "#030509",
              flexShrink: 0,
            }}
          >
            {[...TABS.slice(0, 2), { id: "mission" as Tab, label: "MISSION" }, ...TABS.slice(2)].map((t) => (
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
            <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
              {/* Toggle button */}
              <button
                onClick={() => setShowHistory(h => !h)}
                title={showHistory ? "Ocultar conversas" : "Ver conversas"}
                style={{
                  position: "absolute", top: 10, left: showHistory ? 248 : 8, zIndex: 10,
                  width: 22, height: 22, borderRadius: 4, border: `1px solid ${color}25`,
                  background: showHistory ? `${color}15` : "rgba(255,255,255,0.04)",
                  color: showHistory ? color : "rgba(255,255,255,0.25)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, transition: "left 0.2s, color 0.2s", flexShrink: 0,
                }}
              >
                {showHistory ? "‹" : "›"}
              </button>

              {/* Conversation sidebar — collapsible */}
              {showHistory && (
                <ConversationThreads
                  color={color}
                  activeConversationId={conversationId ?? undefined}
                  onSelectConversation={(id) => { void loadConversation(id); setShowHistory(false); }}
                />
              )}

              <ChatPanel
                profile={profile}
                messages={messages}
                loading={loading}
                activeTools={activeTools}
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
              />
            </div>
          )}
          {tab === "dash" && (
            <DashPanel
              profile={profile}
              projects={projects}
              alerts={alerts}
              connectedProviders={connectedProviders}
              vitals={vitals}
              onSendToChat={handleSend}
            />
          )}
          {tab === "mission" && <MissionControlPanel profile={profile} onSendToChat={handleSend} />}
          {tab === "auto" && <AutoPanel profile={profile} onSendToChat={handleSend} />}
        </div>

        <div className="orion-right-rail"><RightRail
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

      {/* Bottom nav - mobile only */}
      <nav className="orion-bottom-nav">
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          <span className="nav-icon">&#9670;</span>
          CHAT
        </button>
        <button className={tab === "dash" ? "active" : ""} onClick={() => setTab("dash")}>
          <span className="nav-icon">&#11045;</span>
          PAINEL
        </button>
        <button onClick={() => setSidebarOpen(true)}>
          <span className="nav-icon">&#9776;</span>
          MODULOS
        </button>
        <button onClick={() => setNotificationsOpen(true)}>
          <span className="nav-icon">&#128276;</span>
          ALERTAS
        </button>
      </nav>

      <CommandPalette
        open={commandOpen}
        color={color}
        items={commandItems}
        onClose={() => setCommandOpen(false)}
      />
      <NotificationCenter
        open={notificationsOpen}
        color={color}
        alerts={alerts}
        decisions={decisions.data ?? []}
        executedDecisions={executedDecisions.data ?? []}
        onApprove={(alert) => {
          approve(alert);
          handleSend(alert.action);
        }}
        onDismiss={dismiss}
        onApproveDecision={(decision) => {
          return approveDecision.mutateAsync(decision.id);
        }}
        onDismissDecision={(decision) => {
          dismissDecision.mutate(decision.id);
        }}
        onClose={() => setNotificationsOpen(false)}
        onRefresh={scanAlerts}
      />
      {showTour && (
        <OnboardingTour
          color={color}
          onComplete={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
