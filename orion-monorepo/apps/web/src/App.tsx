import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { OrionLayout } from "./components/layout/OrionLayout.js";
import { SignInScreen } from "./pages/SignInScreen.js";
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
import { SleepPage } from "./pages/modules/SleepPage.js";
import { CreativePage } from "./pages/modules/CreativePage.js";
import { GamingPage } from "./pages/modules/GamingPage.js";

/** Wrapper genérico pra rotas autenticadas — evita boilerplate repetido. */
function Authed({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
}

/**
 * Shell raiz do O.R.I.O.N. Tudo passa por aqui.
 * - SignedOut → tela de login Stark
 * - SignedIn  → painel completo (OrionLayout)
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
      <Route path="/integrations" element={<Authed><IntegrationsPage /></Authed>} />
      <Route path="/m/comms" element={<Authed><CommsPage /></Authed>} />
      <Route path="/m/calendar" element={<Authed><AgendaPage /></Authed>} />
      <Route path="/m/life" element={<Authed><LifePage /></Authed>} />
      <Route path="/m/know" element={<Authed><KnowPage /></Authed>} />
      <Route path="/m/career" element={<Authed><CareerPage /></Authed>} />
      <Route path="/m/docs" element={<Authed><DocsPage /></Authed>} />
      <Route path="/m/health" element={<Authed><HealthPage /></Authed>} />
      <Route path="/m/focus" element={<Authed><FocusPage /></Authed>} />
      <Route path="/m/habits" element={<Authed><HabitsPage /></Authed>} />
      <Route path="/m/sleep" element={<Authed><SleepPage /></Authed>} />
      <Route path="/m/creative" element={<Authed><CreativePage /></Authed>} />
      <Route path="/m/gaming" element={<Authed><GamingPage /></Authed>} />
      <Route path="/*" element={<Authed><OrionLayout /></Authed>} />
    </Routes>
  );
}
