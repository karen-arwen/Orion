import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { OrionLayout } from "./components/layout/OrionLayout.js";
import { SignInScreen } from "./pages/SignInScreen.js";
import { OnboardingScreen } from "./pages/OnboardingScreen.js";
import { IntegrationsPage } from "./pages/IntegrationsPage.js";
import { CommsPage } from "./pages/modules/CommsPage.js";
import { AgendaPage } from "./pages/modules/AgendaPage.js";
import { LifePage } from "./pages/modules/LifePage.js";
import { KnowPage } from "./pages/modules/KnowPage.js";
import { CareerPage } from "./pages/modules/CareerPage.js";
import { DocsPage } from "./pages/modules/DocsPage.js";
import { HealthPage } from "./pages/modules/HealthPage.js";
import { FocusPage } from "./pages/modules/FocusPage.js";
import { HabitsPage } from "./pages/modules/HabitsPage.js";
import { CreativePage } from "./pages/modules/CreativePage.js";
import { GamingPage } from "./pages/modules/GamingPage.js";
import { RadarPage } from "./pages/modules/RadarPage.js";
import { SleepPage } from "./pages/modules/SleepPage.js";
import { api } from "./lib/api.js";

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
      <Route path="/m/comms" element={<Authed><CommsPage /></Authed>} />
      <Route path="/m/calendar" element={<Authed><AgendaPage /></Authed>} />
      <Route path="/m/life" element={<Authed><LifePage /></Authed>} />
      <Route path="/m/know" element={<Authed><KnowPage /></Authed>} />
      <Route path="/m/career" element={<Authed><CareerPage /></Authed>} />
      <Route path="/m/docs" element={<Authed><DocsPage /></Authed>} />
      <Route path="/m/health" element={<Authed><HealthPage /></Authed>} />
      <Route path="/m/focus" element={<Authed><FocusPage /></Authed>} />
      <Route path="/m/habit" element={<Authed><HabitsPage /></Authed>} />
      <Route path="/m/creative" element={<Authed><CreativePage /></Authed>} />
      <Route path="/m/gaming" element={<Authed><GamingPage /></Authed>} />
      <Route path="/m/news" element={<Authed><RadarPage /></Authed>} />
      <Route path="/m/sleep" element={<Authed><SleepPage /></Authed>} />
      <Route path="/*" element={<Authed><OrionLayout /></Authed>} />
    </Routes>
  );
}
