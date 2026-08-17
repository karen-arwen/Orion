import type { SocialContact, SocialContactInput, SocialNudge } from "@orion/types";
import { prisma } from "../db/prisma.js";

function toContact(contact: {
  id: string;
  name: string;
  context: string;
  lastInteraction: Date | null;
  nextStep: string;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}): SocialContact {
  return {
    id: contact.id,
    name: contact.name,
    context: contact.context,
    lastInteraction: contact.lastInteraction?.toISOString() ?? null,
    nextStep: contact.nextStep,
    importance: contact.importance,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function listContacts(userId: string): Promise<SocialContact[]> {
  const contacts = await prisma.socialContact.findMany({
    where: { userId },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });
  return contacts.map(toContact);
}

export async function createContact(userId: string, input: SocialContactInput): Promise<SocialContact> {
  const contact = await prisma.socialContact.create({
    data: {
      userId,
      name: input.name,
      context: input.context ?? "",
      lastInteraction: parseDate(input.lastInteraction),
      nextStep: input.nextStep ?? "Enviar mensagem de follow-up",
      importance: input.importance ?? 5,
    },
  });
  await prisma.memory.create({
    data: {
      userId,
      type: "relationship",
      content: `Contato social: ${contact.name}. Contexto: ${contact.context || "sem contexto"}. Proximo passo: ${contact.nextStep}.`,
      importance: Math.min(0.95, Math.max(0.2, contact.importance / 10)),
      embedding: [],
    },
  });
  return toContact(contact);
}

export async function getNudges(userId: string): Promise<SocialNudge[]> {
  const contacts = await listContacts(userId);
  return contacts.slice(0, 8).map((contact) => ({
    contactId: contact.id,
    name: contact.name,
    reason: contact.nextStep || "Relacionamento relevante para manter ativo.",
    messageDraft: `Oi ${contact.name.split(" ")[0]}, lembrei de voce hoje e queria retomar nosso papo. Como voce esta?`,
  }));
}
