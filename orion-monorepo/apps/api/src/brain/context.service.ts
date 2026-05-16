import { prisma } from "../db/prisma.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { calendarList, gmailList } from "../integrations/google-api.js";

/* ═══════════════════════════════════════════════════════════════════
   Brain Context — awareness ambiental do O.R.I.O.N.

   Antes de CADA conversa, coletamos um snapshot do mundo do usuário:
   hora, eventos próximos, emails urgentes, projetos ativos, memórias.
   Esse snapshot vai pro system prompt — o O.R.I.O.N. nunca chega
   "frio" numa conversa.

   Todas as coletas são best-effort: falhas individuais não derrubam
   o resto. A IA sempre recebe ALGUM contexto, mesmo que parcial.
═══════════════════════════════════════════════════════════════════ */

export interface BrainSnapshot {
  now: string;
  weekday: string;
  partOfDay: "madrugada" | "manhã" | "tarde" | "noite";
  upcomingEvents: string[];
  unreadEmails: string[];
  activeProjects: string[];
  recentMemories: string[];
  pendingAlerts: number;
  notes: string[];
}

function partOfDay(hour: number): BrainSnapshot["partOfDay"] {
  if (hour < 6) return "madrugada";
  if (hour < 12) return "manhã";
  if (hour < 18) return "tarde";
  return "noite";
}

/** Coleta o snapshot completo do estado atual do usuário. */
export async function captureBrainSnapshot(userId: string): Promise<BrainSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      integrations: { where: { status: "connected" } },
      projects: true,
      alerts: { where: { dismissed: false } },
    },
  });
  if (!user) throw new Error(`brain: usuário ${userId} não encontrado`);

  const timezone = user.profile?.timezone ?? "America/Sao_Paulo";
  const nowDate = new Date();
  const localNow = nowDate.toLocaleString("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const hourLocal = Number(
    nowDate.toLocaleString("pt-BR", { timeZone: timezone, hour: "2-digit", hour12: false }),
  );
  const weekday = nowDate.toLocaleString("pt-BR", { timeZone: timezone, weekday: "long" });

  const snapshot: BrainSnapshot = {
    now: localNow,
    weekday,
    partOfDay: partOfDay(hourLocal),
    upcomingEvents: [],
    unreadEmails: [],
    activeProjects: [],
    recentMemories: [],
    pendingAlerts: user.alerts.length,
    notes: [],
  };

  // ── Projetos ativos (Postgres, instantâneo) ────────────────────
  snapshot.activeProjects = user.projects.slice(0, 5).map(
    (p) => `${p.name} — ${p.progress}% (${p.status})`,
  );

  // ── Memórias relevantes (Postgres) ─────────────────────────────
  const memories = await prisma.memory.findMany({
    where: { userId },
    orderBy: { importance: "desc" },
    take: 8,
  });
  snapshot.recentMemories = memories.map((m) => `[${m.type}] ${m.content}`);

  // ── Calendar: próximos eventos (24h) ───────────────────────────
  const gcal = user.integrations.find((i) => i.provider === "gcal");
  if (gcal) {
    const token = await tryEnsureFreshAccessToken(gcal);
    if (token) {
      try {
        const events = await calendarList(token, {
          timeMin: nowDate.toISOString(),
          timeMax: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          maxResults: 5,
        });
        snapshot.upcomingEvents = events.map((e) => {
          const start = new Date(e.start).toLocaleString("pt-BR", {
            timeZone: timezone,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `${start} — ${e.summary}${e.location ? ` (${e.location})` : ""}`;
        });
      } catch (err) {
        snapshot.notes.push(`calendar indisponível: ${(err as Error).message.slice(0, 80)}`);
      }
    }
  }

  // ── Gmail: não lidos das últimas 24h ───────────────────────────
  const gmail = user.integrations.find((i) => i.provider === "gmail");
  if (gmail) {
    const token = await tryEnsureFreshAccessToken(gmail);
    if (token) {
      try {
        const unread = await gmailList(token, {
          query: "is:unread newer_than:1d",
          maxResults: 5,
        });
        snapshot.unreadEmails = unread.map((m) => `${m.from} — ${m.subject}`);
      } catch (err) {
        snapshot.notes.push(`gmail indisponível: ${(err as Error).message.slice(0, 80)}`);
      }
    }
  }

  return snapshot;
}

/** Formata o snapshot como texto pro system prompt. */
export function renderBrainContext(snap: BrainSnapshot): string {
  const lines: string[] = [];
  lines.push(`Hora local: ${snap.now} (${snap.partOfDay}, ${snap.weekday})`);

  if (snap.upcomingEvents.length > 0) {
    lines.push("", "Próximos eventos (24h):");
    for (const e of snap.upcomingEvents) lines.push(`  • ${e}`);
  } else {
    lines.push("", "Próximos eventos: agenda livre nas próximas 24h.");
  }

  if (snap.unreadEmails.length > 0) {
    lines.push("", "Emails não lidos (24h):");
    for (const e of snap.unreadEmails) lines.push(`  • ${e}`);
  }

  if (snap.activeProjects.length > 0) {
    lines.push("", "Projetos ativos:");
    for (const p of snap.activeProjects) lines.push(`  • ${p}`);
  }

  if (snap.recentMemories.length > 0) {
    lines.push("", "O que você já aprendeu sobre o usuário:");
    for (const m of snap.recentMemories) lines.push(`  • ${m}`);
  }

  if (snap.pendingAlerts > 0) {
    lines.push("", `Alertas proativos pendentes: ${snap.pendingAlerts}`);
  }

  if (snap.notes.length > 0) {
    lines.push("", "Notas internas:");
    for (const n of snap.notes) lines.push(`  ⚠ ${n}`);
  }

  return lines.join("\n");
}
