import { lazy, Suspense, useEffect, useState, type LazyExoticComponent } from "react"; // useState kept for OnboardingGate
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { api } from "./lib/api.js";
import { ErrorBoundary } from "./components/visual/ErrorBoundary.js";

type LazyPage = LazyExoticComponent<() => JSX.Element>;

function lazyNamed(
  loader: () => Promise<Record<string, () => JSX.Element>>,
  exportName: string,
): LazyPage {
  return lazy(async () => {
    const mod = await loader();
    const component = mod[exportName];
    if (!component) throw new Error(`Missing lazy export: ${exportName}`);
    return { default: component };
  });
}

const OrionLayout = lazyNamed(() => import("./components/layout/OrionLayout.js"), "OrionLayout");
const SignInScreen = lazyNamed(() => import("./pages/SignInScreen.js"), "SignInScreen");
const OnboardingScreen = lazyNamed(() => import("./pages/OnboardingScreen.js"), "OnboardingScreen");
const IntegrationsPage = lazyNamed(() => import("./pages/IntegrationsPage.js"), "IntegrationsPage");
const CommsPage = lazyNamed(() => import("./pages/modules/CommsPage.js"), "CommsPage");
const AgendaPage = lazyNamed(() => import("./pages/modules/AgendaPage.js"), "AgendaPage");
const LifePage = lazyNamed(() => import("./pages/modules/LifePage.js"), "LifePage");
const KnowPage = lazyNamed(() => import("./pages/modules/KnowPage.js"), "KnowPage");
const CareerPage = lazyNamed(() => import("./pages/modules/CareerPage.js"), "CareerPage");
const FinancePage = lazyNamed(() => import("./pages/modules/FinancePage.js"), "FinancePage");
const DocsPage = lazyNamed(() => import("./pages/modules/DocsPage.js"), "DocsPage");
const HealthPage = lazyNamed(() => import("./pages/modules/HealthPage.js"), "HealthPage");
const FocusPage = lazyNamed(() => import("./pages/modules/FocusPage.js"), "FocusPage");
const HabitsPage = lazyNamed(() => import("./pages/modules/HabitsPage.js"), "HabitsPage");
const CreativePage = lazyNamed(() => import("./pages/modules/CreativePage.js"), "CreativePage");
const MediaPage = lazyNamed(() => import("./pages/modules/MediaPage.js"), "MediaPage");
const GamingPage = lazyNamed(() => import("./pages/modules/GamingPage.js"), "GamingPage");
const RadarPage = lazyNamed(() => import("./pages/modules/RadarPage.js"), "RadarPage");
const SleepPage = lazyNamed(() => import("./pages/modules/SleepPage.js"), "SleepPage");
const ShopPage = lazyNamed(() => import("./pages/modules/ShopPage.js"), "ShopPage");
const TravelPage = lazyNamed(() => import("./pages/modules/TravelPage.js"), "TravelPage");
const LanguagePage = lazyNamed(() => import("./pages/modules/LanguagePage.js"), "LanguagePage");
const WhatIfPage = lazyNamed(() => import("./pages/modules/WhatIfPage.js"), "WhatIfPage");
const ChefPage = lazyNamed(() => import("./pages/modules/ChefPage.js"), "ChefPage");
const MindsetPage = lazyNamed(() => import("./pages/modules/MindsetPage.js"), "MindsetPage");
const SocialPage = lazyNamed(() => import("./pages/modules/SocialPage.js"), "SocialPage");
const SecurityPage = lazyNamed(() => import("./pages/modules/SecurityPage.js"), "SecurityPage");
const DevPage = lazyNamed(() => import("./pages/modules/DevPage.js"), "DevPage");
const InboxPage = lazyNamed(() => import("./pages/InboxPage.js"), "InboxPage");
const TimelinePage = lazyNamed(() => import("./pages/TimelinePage.js"), "TimelinePage");
const AutonomyPage = lazyNamed(() => import("./pages/AutonomyPage.js"), "AutonomyPage");
const BehavioralProfilePage = lazyNamed(() => import("./pages/BehavioralProfilePage.js"), "BehavioralProfilePage");
const QuestPage = lazyNamed(() => import("./pages/modules/QuestPage.js"), "QuestPage");
const RoutinePage = lazyNamed(() => import("./pages/modules/RoutinePage.js"), "RoutinePage");
const JournalPage = lazyNamed(() => import("./pages/modules/JournalPage.js"), "JournalPage");
const ProjectsPage = lazyNamed(() => import("./pages/modules/ProjectsPage.js"), "ProjectsPage");
const DashboardPage = lazyNamed(() => import("./pages/DashboardPage.js"), "DashboardPage");

/** Wrapper de rotas autenticadas + redirect pro onboarding se faltar. */
function Authed({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <>
      <SignedIn>
        <OnboardingGate>{children}</OnboardingGate>
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
}

/** Verifica /v1/onboarding/status uma vez por sessão. Se não onboardou e
 *  não está em /onboarding, redireciona. */
function OnboardingGate({ children }: { children: JSX.Element }): JSX.Element {
  const { isLoaded, isSignedIn } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (location.pathname === "/onboarding") {
      setChecked(true);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const status = await api.onboarding.status();
        if (active && !status.onboarded) {
          navigate("/onboarding", { replace: true });
        }
      } catch {
        // backend pode estar indisponível — segue sem bloquear
      } finally {
        if (active) setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, location.pathname, navigate]);

  if (!checked && location.pathname !== "/onboarding") return <BootSplash />;
  return children;
}

function BootSplash(): JSX.Element {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#030509",
        color: "#00D4FF",
        fontFamily: "'Share Tech Mono', monospace",
        letterSpacing: "0.3em",
        fontSize: 12,
        textShadow: "0 0 12px #00D4FF80",
      }}
    >
      ◌ INICIALIZANDO NÚCLEO…
    </div>
  );
}

/**
 * Shell raiz do O.R.I.O.N. Tudo passa por aqui.
 * - SignedOut → tela de login Stark
 * - SignedIn sem onboarding → OnboardingScreen
 * - SignedIn com onboarding → painel completo
 */
export function App(): JSX.Element {
  return (
    <ErrorBoundary>
    <Suspense fallback={<BootSplash />}>
      <Routes>
        <Route
          path="/sign-in/*"
          element={
            <SignedOut>
              <SignInScreen />
            </SignedOut>
          }
        />
        <Route path="/onboarding" element={<Authed><OnboardingScreen /></Authed>} />
        <Route path="/integrations" element={<Authed><IntegrationsPage /></Authed>} />
        {/* Rotas dos modulos — paths em sincronia com backend /v1/m/* */}
        <Route path="/m/comms" element={<Authed><CommsPage /></Authed>} />
        <Route path="/m/agenda" element={<Authed><AgendaPage /></Authed>} />
        {/* alias antigo /m/calendar pra nao quebrar bookmarks */}
        <Route path="/m/calendar" element={<Navigate to="/m/agenda" replace />} />
        <Route path="/m/life" element={<Authed><LifePage /></Authed>} />
        <Route path="/m/know" element={<Authed><KnowPage /></Authed>} />
        <Route path="/m/career" element={<Authed><CareerPage /></Authed>} />
        <Route path="/m/finance" element={<Authed><FinancePage /></Authed>} />
        <Route path="/m/docs" element={<Authed><DocsPage /></Authed>} />
        <Route path="/m/health" element={<Authed><HealthPage /></Authed>} />
        <Route path="/m/focus" element={<Authed><FocusPage /></Authed>} />
        <Route path="/m/habits" element={<Authed><HabitsPage /></Authed>} />
        {/* alias antigo /m/habit pra nao quebrar bookmarks */}
        <Route path="/m/habit" element={<Navigate to="/m/habits" replace />} />
        <Route path="/m/creative" element={<Authed><CreativePage /></Authed>} />
        <Route path="/m/media" element={<Authed><MediaPage /></Authed>} />
        <Route path="/m/gaming" element={<Authed><GamingPage /></Authed>} />
        <Route path="/m/news" element={<Authed><RadarPage /></Authed>} />
        <Route path="/m/sleep" element={<Authed><SleepPage /></Authed>} />
        <Route path="/m/shop" element={<Authed><ShopPage /></Authed>} />
        <Route path="/m/travel" element={<Authed><TravelPage /></Authed>} />
        <Route path="/m/language" element={<Authed><LanguagePage /></Authed>} />
        <Route path="/m/whatif" element={<Authed><WhatIfPage /></Authed>} />
        <Route path="/m/chef" element={<Authed><ChefPage /></Authed>} />
        <Route path="/m/mindset" element={<Authed><MindsetPage /></Authed>} />
        <Route path="/m/social" element={<Authed><SocialPage /></Authed>} />
        <Route path="/m/security" element={<Authed><SecurityPage /></Authed>} />
        {/* alias antigo /m/sec pra nao quebrar bookmarks */}
        <Route path="/m/sec" element={<Navigate to="/m/security" replace />} />
        <Route path="/m/dev" element={<Authed><DevPage /></Authed>} />
        <Route path="/inbox" element={<Authed><InboxPage /></Authed>} />
        <Route path="/timeline" element={<Authed><TimelinePage /></Authed>} />
        <Route path="/autonomy" element={<Authed><AutonomyPage /></Authed>} />
        <Route path="/m/quest" element={<Authed><QuestPage /></Authed>} />
        <Route path="/dashboard" element={<Authed><DashboardPage /></Authed>} />
        <Route path="/m/routines" element={<Authed><RoutinePage /></Authed>} />
        <Route path="/m/journal" element={<Authed><JournalPage /></Authed>} />
        <Route path="/m/projects" element={<Authed><ProjectsPage /></Authed>} />
        <Route path="/*" element={<Authed><OrionLayout /></Authed>} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
