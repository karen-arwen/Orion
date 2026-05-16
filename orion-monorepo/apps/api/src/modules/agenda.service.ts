import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { calendarList, type CalEvent } from "../integrations/google-api.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";

/* ═══════════════════════════════════════════════════════════════════
   AGENDA — Módulo de calendário inteligente.

   - getWeek: 7 dias de eventos agrupados por dia
   - getToday: eventos de hoje
   - detectConflicts: encontra sobreposições
   - suggestFocusBlock: usa Claude pra sugerir um bloco de foco hoje
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface DayBucket {
  date: string;
  weekday: string;
  events: CalEvent[];
}

async function getCalToken(userId: string): Promise<string | null> {
  const integ = await prisma.integration.findFirst({
    where: { userId, provider: "gcal", status: "connected" },
  });
  if (!integ) return null;
  return tryEnsureFreshAccessToken(integ);
}

/** Retorna 7 dias agrupados por dia (hoje + 6). */
export async function getWeek(userId: string, timezone: string): Promise<DayBucket[]> {
  const token = await getCalToken(userId);
  if (!token) throw new Error("Calendar não conectado");

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);

  const events = await calendarList(token, {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    maxResults: 100,
  });

  const buckets: Record<string, DayBucket> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = {
      date: key,
      weekday: d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: timezone }),
      events: [],
    };
  }

  for (const ev of events) {
    const day = (ev.start || "").slice(0, 10);
    if (buckets[day]) buckets[day].events.push(ev);
  }

  return Object.values(buckets);
}

/** Eventos de hoje. */
export async function getToday(userId: string): Promise<CalEvent[]> {
  const token = await getCalToken(userId);
  if (!token) throw new Error("Calendar não conectado");

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return calendarList(token, {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    maxResults: 30,
  });
}

/** Detecta sobreposição de eventos (conflitos). */
export function detectConflicts(events: CalEvent[]): Array<[CalEvent, CalEvent]> {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const conflicts: Array<[CalEvent, CalEvent]> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (!a || !b) continue;
      if (a.end > b.start) {
        conflicts.push([a, b]);
      } else {
        break;
      }
    }
  }
  return conflicts;
}

/** Pergunta ao Claude um bloco de foco ideal pra hoje. */
export async function suggestFocusBlock(userId: string, timezone: string): Promise<string> {
  const events = await getToday(userId);
  const lines = events.length
    ? events.map((e) => `- ${e.start} → ${e.end}: ${e.summary}`).join("\n")
    : "Sem compromissos hoje.";

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 250,
    temperature: 0.6,
    system: `Você é o O.R.I.O.N. sugerindo um bloco de foco realista.
Tom sofisticado, conciso. Sugira UM intervalo concreto (HH:MM-HH:MM) e por que cabe ali.
3 linhas no máximo. Tz do usuário: ${timezone}.`,
    messages: [
      {
        role: "user",
        content: `Agenda de hoje:\n${lines}\n\nOnde encaixa um bloco de foco de 90min?`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
