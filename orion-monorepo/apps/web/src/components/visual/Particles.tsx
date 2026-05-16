import { useMemo } from "react";

interface ParticlesProps {
  color: string;
  count?: number;
}

interface Particle {
  left: number;
  top: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
}

/**
 * Fundo de partículas + scan line.
 * Computado uma vez via useMemo pra não re-randomizar a cada render.
 */
export function Particles({ color, count = 18 }: ParticlesProps): JSX.Element {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() > 0.7 ? 2 : 1,
        opacity: Math.random() * 0.4 + 0.05,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 10,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: color,
            opacity: p.opacity,
            animation: `floatP ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}15, ${color}30, ${color}15, transparent)`,
          animation: "scanV 8s linear infinite",
        }}
      />
    </div>
  );
}
