import type { ChatActionCard } from "../../lib/actionCards.js";

interface ActionCardProps {
  card: ChatActionCard;
  color: string;
  onRun: (command: string) => void;
}

const TONE_COLOR: Record<ChatActionCard["tone"], string> = {
  primary: "#00D4FF",
  warn: "#F59E0B",
  system: "#10B981",
};

export function ActionCard({ card, color, onRun }: ActionCardProps): JSX.Element {
  const tone = card.tone === "primary" ? color : TONE_COLOR[card.tone];
  return (
    <button
      onClick={() => onRun(card.command)}
      className="orion-action-card"
      style={{
        borderColor: `${tone}45`,
        background: `linear-gradient(135deg, ${tone}16, rgba(255,255,255,0.015))`,
        boxShadow: `0 0 14px ${tone}10`,
      }}
    >
      <span className="hud-label" style={{ color: tone, fontSize: 9 }}>{card.title}</span>
      <span>{card.detail}</span>
      <strong style={{ color: tone }}>EXECUTAR</strong>
    </button>
  );
}
