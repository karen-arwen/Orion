import type { Config } from "tailwindcss";

/* ═══════════════════════════════════════════════════════════════════
   Tailwind config do O.R.I.O.N.
   Paleta HUD sci-fi · Share Tech Mono + Rajdhani.
═══════════════════════════════════════════════════════════════════ */

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orion: {
          bg: "#030509",
          surface: "#0A0F1A",
          primary: "#00D4FF",
          secondary: "#7C3AED",
          accent: "#F59E0B",
          success: "#10B981",
          danger: "#EF4444",
          pink: "#EC4899",
          muted: "#64748B",
        },
      },
      fontFamily: {
        hud: ["'Share Tech Mono'", "monospace"],
        body: ["'Rajdhani'", "sans-serif"],
        mono: ["'Share Tech Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 16px rgba(0, 212, 255, 0.4)",
        "glow-purple": "0 0 16px rgba(124, 58, 237, 0.4)",
      },
      keyframes: {
        spin: { to: { transform: "rotate(360deg)" } },
        spinR: { to: { transform: "rotate(-360deg)" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        floatP: {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-30px)" },
        },
        scanV: { "0%": { top: "-1px" }, "100%": { top: "100%" } },
        ripple: {
          "0%": { boxShadow: "0 0 0 0 currentColor" },
          "70%": { boxShadow: "0 0 0 5px transparent" },
          "100%": { boxShadow: "0 0 0 0 transparent" },
        },
      },
      animation: {
        spin: "spin 30s linear infinite",
        spinR: "spinR 20s linear infinite",
        blink: "blink 0.8s infinite",
        fadeUp: "fadeUp 0.25s ease",
        floatP: "floatP 12s ease-in-out infinite alternate",
        scanV: "scanV 8s linear infinite",
        ripple: "ripple 2s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
