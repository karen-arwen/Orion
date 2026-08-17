import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { calendarList } from "../integrations/google-api.js";
import { searchRelevantMemories } from "../memory/long-term.service.js";

/* ═══════════════════════════════════════════════════════════════════
   CALENDAR INTELLIGENCE — o ORION entende sua agenda.

   Funcionalidades:
   - Detectar conflitos de horário automaticamente
   - Prep automático para reuniões (quem é, histórico, pauta)
   - Sugerir horários livres
   - Análise de carga de reuniões na semana
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Array<{
    event1: string;
    event2: string;
    overlapMinutes: number;
  }>;
}

interface MeetingPrep {
  eventTitle: string;
  attendees: string[];
  context: string;      // o que o ORION sabe sobre os participantes
  suggestedAgenda: string;
  relevantHistory: string;
}

interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

/** Detecta conflitos de horário nos próximos N dias */
export async function detectConflicts(
  accessToken: string,
  days = 7,
): Promise<ConflictResult> {
  const events = await calendarList(accessToken, {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
    maxResults: 50,
  }).catch(() => []);
  const conflicts: ConflictResult["conflicts"] = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]!;
      const b = events[j]!;
      const aStart = new Date(a.start).getTime();
      const aEnd = new Date(a.end).getTime();
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();

      if (aStart < bEnd && bStart < aEnd) {
        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        conflicts.push({
          event1: a.summary,
          event2: b.summary,
          overlapMinutes: Math.round((overlapEnd - overlapStart) / 60000),
        });
      }
    }
  }

  return { hasConflicts: conflicts.length > 0, conflicts };
}

/** Prepara briefing para uma reunião específica */
export async function prepareMeetingBrief(
  userId: string,
  accessToken: string,
  eventId: string,
): Promise<MeetingPrep | null> {
  const events = await calendarList(accessToken, {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    maxResults: 50,
  }).catch(() => []);
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;

  const attendeeNames: string[] = (event?.attendees ?? [])
    .filter((a: string) => !a.includes("resource.calendar"));

  // Buscar contexto sobre cada participante
  const attendeeContexts: string[] = [];
  for (let ai = 0; ai < Math.min(attendeeNames.length, 5); ai++) {
    const attendee = attendeeNames[ai] ?? "";
    if (!attendee) continue;
    const name = attendee.split("@")[0]!.replace(/\./g, " ");
    const memories = await searchRelevantMemories(userId, name, 2).catch(() => []);
    if (memories.length > 0) {
      attendeeContexts.push(`${name}: ${memories.map((m) => m.content).join("; ")}`);
    }
  }

  // Buscar contexto sobre o tema da reunião
  const topicMemories = await searchRelevantMemories(userId, event.summary, 3).catch(() => []);

  const prompt = `
Reuniao: ${event.summary}
Horario: ${event.start} - ${event.end}
${event.location ? `Local: ${event.location}` : ""}
${event.description ? `Descricao: ${event.description.slice(0, 500)}` : ""}
Participantes: ${attendeeNames.join(", ") || "nao especificado"}

${attendeeContexts.length ? `Contexto sobre participantes:\n${attendeeContexts.join("\n")}` : ""}
${topicMemories.length ? `Historico sobre o tema:\n${topicMemories.map((m) => `- ${m.content}`).join("\n")}` : ""}

Gere 3-5 pontos de pauta sugeridos para esta reuniao. Seja especifico baseado no contexto.`.trim();

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: "Voce e o O.R.I.O.N preparando o usuario para uma reuniao. Sugira pontos de pauta concretos baseados no contexto. Seja direto, sem introducoes.",
      messages: [{ role: "user", content: prompt }],
    });

    const agenda = msg.content[0]?.type === "text" ? msg.content[0].text : "";

    return {
      eventTitle: event.summary,
      attendees: attendeeNames,
      context: attendeeContexts.join("\n") || "Sem contexto adicional sobre participantes.",
      suggestedAgenda: agenda,
      relevantHistory: topicMemories.map((m) => m.content).join("\n") || "Sem historico relevante.",
    };
  } catch {
    return null;
  }
}

/** Encontra slots livres nos próximos N dias */
export async function findFreeSlots(
  accessToken: string,
  days = 3,
  minMinutes = 30,
): Promise<FreeSlot[]> {
  const events = await calendarList(accessToken, {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
    maxResults: 50,
  }).catch(() => []);
  const slots: FreeSlot[] = [];

  const now = new Date();
  const workStart = 8; // 8h
  const workEnd = 18;  // 18h

  for (let d = 0; d < days; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    day.setHours(workStart, 0, 0, 0);

    // Skip weekends
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    const dayEnd = new Date(day);
    dayEnd.setHours(workEnd, 0, 0, 0);

    // Get events for this day
    const dayStr = day.toISOString().slice(0, 10);
    const dayEvents = events
      .filter((e) => e.start.startsWith(dayStr))
      .map((e) => ({ start: new Date(e.start).getTime(), end: new Date(e.end).getTime() }))
      .sort((a, b) => a.start - b.start);

    let cursor = d === 0 ? Math.max(now.getTime(), day.getTime()) : day.getTime();

    for (const event of dayEvents) {
      if (event.start > cursor) {
        const gap = Math.round((event.start - cursor) / 60000);
        if (gap >= minMinutes) {
          slots.push({
            start: new Date(cursor).toISOString(),
            end: new Date(event.start).toISOString(),
            durationMinutes: gap,
          });
        }
      }
      cursor = Math.max(cursor, event.end);
    }

    // Gap after last event until end of day
    if (cursor < dayEnd.getTime()) {
      const gap = Math.round((dayEnd.getTime() - cursor) / 60000);
      if (gap >= minMinutes) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: dayEnd.toISOString(),
          durationMinutes: gap,
        });
      }
    }
  }

  return slots;
}

/** Análise de carga semanal de reuniões */
export async function analyzeWeeklyLoad(accessToken: string): Promise<{
  totalMeetings: number;
  totalMinutes: number;
  busiestDay: string;
  averagePerDay: number;
  recommendation: string;
}> {
  const events = await calendarList(accessToken, {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    maxResults: 50,
  }).catch(() => []);
  const dayCount: Record<string, number> = {};
  let totalMinutes = 0;

  for (const event of events) {
    const day = event.start.slice(0, 10);
    dayCount[day] = (dayCount[day] ?? 0) + 1;
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    totalMinutes += Math.round((end - start) / 60000);
  }

  const busiestDay = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";
  const avgPerDay = events.length > 0 ? Math.round(events.length / 5 * 10) / 10 : 0;

  let recommendation = "Carga equilibrada.";
  if (totalMinutes > 20 * 60) recommendation = "Semana pesada de reunioes. Reserve blocos de foco entre elas.";
  else if (events.length > 15) recommendation = "Muitas reunioes. Considere cancelar ou delegar as menos criticas.";
  else if (totalMinutes < 5 * 60) recommendation = "Poucas reunioes — bom momento para trabalho profundo.";

  return {
    totalMeetings: events.length,
    totalMinutes,
    busiestDay,
    averagePerDay: avgPerDay,
    recommendation,
  };
}
