import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@clerk/clerk-react";
import type { UserProfile } from "@orion/types";
import { useUserStore } from "../../stores/user.store.js";
import { Particles } from "../visual/Particles.js";
import { NeuralRing } from "../visual/NeuralRing.js";

interface ModuleShellProps {
  icon: string;
  label: string;
  sub: string;
  color: string;
  children: ReactNode;
}

export function ModuleShell({ icon, label, sub, color, children }: ModuleShellProps): JSX.Element {
  const { user } = useUser();
  const { profile, hydrate } = useUserStore();

  useEffect(() => {
    if (user && !profile) {
      const fallback: UserProfile = {
        id: user.id,
        name: user.firstName ?? "Operador",
        email: user.primaryEmailAddress?.emailAddress ?? "",
        avatar: (user.firstName?.[0] ?? "O") + (user.lastName?.[0] ?? "P"),
        avatarColor: color,
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
    }
  }, [user, profile, hydrate, color]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #030509 0%, #050810 50%, #030509 100%)",
        color: "#fff",
        fontFamily: "'Rajdhani', sans-serif",
        position: "relative",
      }}
    >
      <Particles color={color} />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          position: "relative",
          zIndex: 5,
          padding: "28px 32px 14px",
          borderBottom: `1px solid ${color}18`,
          background: "rgba(3,5,9,0.6)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <NeuralRing color={color} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22, color, filter: `drop-shadow(0 0 8px ${color})` }}>
                {icon}
              </span>
              <span
                className="hud-label text-glow"
                style={{ fontSize: 18, color, letterSpacing: "0.22em" }}
              >
                {label}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                marginTop: 4,
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              {sub}
            </div>
          </div>
          <Link
            to="/"
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              border: `1px solid ${color}30`,
              color: `${color}aa`,
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            {"<-"} NEXUS
          </Link>
        </div>
      </motion.div>

      <motion.div
        className="module-shell-content"
        style={{ position: "relative", zIndex: 5, paddingBottom: 60 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
