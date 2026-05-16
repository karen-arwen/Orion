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
      <Route path="/*" element={<Authed><OrionLayout /></Authed>} />
    </Routes>
  );
}
