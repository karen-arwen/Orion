import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════
   INSTALL PROMPT — incentiva instalar o ORION como app.
   Aparece depois de 3 visitas ou 2 min de uso. Estilo HUD discreto.
═══════════════════════════════════════════════════════════════════ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt({ color }: { color: string }): JSX.Element | null {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (sessionStorage.getItem("orion_install_dismissed")) return;
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event): void => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 2 min delay
      setTimeout(() => setShow(true), 120_000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async (): Promise<void> => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = (): void => {
    setDismissed(true);
    setShow(false);
    sessionStorage.setItem("orion_install_dismissed", "1");
  };

  if (dismissed || !show || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 500,
          padding: "12px 20px",
          background: "rgba(3,5,9,0.95)",
          border: `1px solid ${color}30`,
          borderRadius: 12,
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 20px ${color}10`,
          maxWidth: 360,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            Instalar O.R.I.O.N
          </div>
          <div style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Share Tech Mono', monospace",
            marginTop: 2,
          }}>
            Acesso rapido, notificacoes e modo offline
          </div>
        </div>
        <button
          onClick={() => void handleInstall()}
          style={{
            padding: "6px 14px",
            fontSize: 10,
            fontFamily: "'Share Tech Mono', monospace",
            background: `${color}18`,
            border: `1px solid ${color}40`,
            color,
            borderRadius: 6,
            cursor: "pointer",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          INSTALAR
        </button>
        <button
          onClick={handleDismiss}
          style={{
            width: 20,
            height: 20,
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.2)",
            cursor: "pointer",
            fontSize: 14,
          }}
          aria-label="Fechar"
        >
          x
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
