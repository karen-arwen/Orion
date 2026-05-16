import { SignIn } from "@clerk/clerk-react";
import { NeuralRing } from "../components/visual/NeuralRing.js";

/**
 * Tela de boot do O.R.I.O.N — login com Google via Clerk.
 * Estética HUD: anéis neurais animados + label cyan.
 */
export function SignInScreen(): JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-orion-bg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,212,255,0.08),transparent_60%),radial-gradient(circle_at_70%_50%,rgba(124,58,237,0.06),transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <NeuralRing color="#00D4FF" size={90} />
        <div className="text-center">
          <div className="hud-label text-2xl text-orion-primary text-glow">O.R.I.O.N</div>
          <div className="mt-1 text-[10px] tracking-[0.3em] text-white/30">
            OMNI-RESPONSIVE INTELLIGENT OPERATING NEXUS
          </div>
          <div className="mt-4 text-xs text-white/40">Autorize seu acesso para inicializar o núcleo.</div>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-in"
          appearance={{
            variables: {
              colorPrimary: "#00D4FF",
              colorBackground: "#0A0F1A",
              colorText: "#fff",
              colorInputBackground: "#030509",
              colorInputText: "#fff",
              borderRadius: "8px",
            },
            elements: {
              card: "border border-cyan-500/20 shadow-[0_0_40px_rgba(0,212,255,0.15)]",
            },
          }}
        />
      </div>
    </div>
  );
}
