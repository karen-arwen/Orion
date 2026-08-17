import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   SOCIAL CRM ATIVO — o ORION cuida dos seus relacionamentos.

   - Detecta contatos importantes sem interação recente
   - Sugere mensagens contextuais para reconexão
   - Monitora aniversários e datas importantes
   - Gera nudges inteligentes baseados em importância e frequência
═══════════════════════════════════════════════════════════════════ */

interface ContactNudge {
  contactId: string;
  contactName: string;
  importance: number;
  daysSinceContact: number;
  reason: string;
  suggestedAction: string;
}

export async function getContactNudges(userId: string): Promise<ContactNudge[]> {
  const nudges: ContactNudge[] = [];
  const now = new Date();

  const contacts = await prisma.socialContact.findMany({
    where: { userId },
    orderBy: { importance: "desc" },
  });

  for (const contact of contacts) {
    const lastContact = contact.lastInteraction;
    if (!lastContact) {
      // Never contacted — nudge if important
      if (contact.importance >= 7) {
        nudges.push({
          contactId: contact.id,
          contactName: contact.name,
          importance: contact.importance,
          daysSinceContact: -1,
          reason: `Contato importante sem nenhuma interacao registrada.`,
          suggestedAction: `Enviar uma mensagem para ${contact.name}: "${contact.nextStep || 'Oi! Como voce esta?'}"`,
        });
      }
      continue;
    }

    const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (24 * 3600 * 1000));

    // Thresholds based on importance (1-10)
    const thresholds: Record<string, number> = {
      "10": 7,   // Very important: every week
      "9": 14,
      "8": 21,
      "7": 30,   // Important: monthly
      "6": 45,
      "5": 60,   // Medium: every 2 months
    };

    const threshold = thresholds[String(Math.min(10, contact.importance))] ?? 90;

    if (daysSince >= threshold) {
      const urgency = daysSince >= threshold * 2 ? "esfriando" : "hora de reconectar";

      nudges.push({
        contactId: contact.id,
        contactName: contact.name,
        importance: contact.importance,
        daysSinceContact: daysSince,
        reason: `Faz ${daysSince} dias sem contato (limite: ${threshold}d). Status: ${urgency}.`,
        suggestedAction: contact.nextStep
          ? `Proximo passo definido: "${contact.nextStep}"`
          : `Mandar mensagem: "Oi ${contact.name.split(" ")[0]}, tudo bem? Faz tempo que nao conversamos."`,
      });
    }
  }

  return nudges.sort((a, b) => {
    // Sort by: importance desc, then daysSince desc
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.daysSinceContact - a.daysSinceContact;
  }).slice(0, 10);
}

/** Retorna contatos com aniversário nos próximos N dias */
export async function getUpcomingBirthdays(userId: string, days = 7): Promise<Array<{
  contactName: string;
  daysUntil: number;
}>> {
  // Birthdays stored as memory type "fact" with content like "aniversario de X: DD/MM"
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      content: { contains: "aniversario" },
    },
  });

  const results: Array<{ contactName: string; daysUntil: number }> = [];
  const now = new Date();

  for (const mem of memories) {
    // Parse "aniversario de [Name]: DD/MM" or similar patterns
    const match = mem.content.match(/anivers[aá]rio\s+(?:de\s+)?(.+?):\s*(\d{1,2})[/\-](\d{1,2})/i);
    if (!match) continue;

    const name = match[1]!.trim();
    const day = parseInt(match[2]!, 10);
    const month = parseInt(match[3]!, 10) - 1;

    const birthday = new Date(now.getFullYear(), month, day);
    if (birthday < now) birthday.setFullYear(birthday.getFullYear() + 1);

    const daysUntil = Math.floor((birthday.getTime() - now.getTime()) / (24 * 3600 * 1000));
    if (daysUntil <= days) {
      results.push({ contactName: name, daysUntil });
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}
