import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { ClerkTokenBridge } from "./lib/clerk-token-bridge.js";
import "./index.css";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!CLERK_KEY) {
  console.warn("⚠ VITE_CLERK_PUBLISHABLE_KEY ausente — auth não funcionará");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element não encontrado");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY ?? "pk_test_placeholder"} afterSignOutUrl="/">
      <ClerkTokenBridge />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] service worker registration failed", err);
    });
  });
}
