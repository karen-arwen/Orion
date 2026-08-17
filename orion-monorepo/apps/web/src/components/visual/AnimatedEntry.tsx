import { motion, type Variants } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════════
   ANIMATED ENTRY — wrapper reutilizavel com Framer Motion.

   Tipos: fade, slideUp, slideLeft, slideRight, scale, glow
   Usa-se em mensagens, cards, paginas e componentes do HUD.
═══════════════════════════════════════════════════════════════════ */

type EntryType = "fade" | "slideUp" | "slideLeft" | "slideRight" | "scale" | "glow";

interface AnimatedEntryProps {
  children: ReactNode;
  type?: EntryType;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
  className?: string;
}

const variants: Record<EntryType, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  },
  slideRight: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 },
  },
  glow: {
    hidden: { opacity: 0, scale: 0.95, filter: "brightness(0.7)" },
    visible: { opacity: 1, scale: 1, filter: "brightness(1)" },
  },
};

export function AnimatedEntry({
  children,
  type = "slideUp",
  delay = 0,
  duration = 0.35,
  style,
  className,
}: AnimatedEntryProps): JSX.Element {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants[type]}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Page transition wrapper ─────────────────────────────────── */

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
      style={{ flex: 1 }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Staggered list ──────────────────────────────────────────── */

interface StaggeredListProps {
  children: ReactNode;
  stagger?: number;
  style?: CSSProperties;
  className?: string;
}

const containerVariants: Variants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function StaggeredList({ children, stagger = 0.05, style, className }: StaggeredListProps): JSX.Element {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      custom={stagger}
      variants={containerVariants}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredItem({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }): JSX.Element {
  return (
    <motion.div variants={itemVariants} style={style} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Hover scale (para cards) ────────────────────────────────── */

interface HoverScaleProps {
  children: ReactNode;
  scale?: number;
  style?: CSSProperties;
  className?: string;
}

export function HoverScale({ children, scale: s = 1.02, style, className }: HoverScaleProps): JSX.Element {
  return (
    <motion.div
      whileHover={{ scale: s, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}
