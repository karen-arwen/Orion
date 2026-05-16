import type {
  ContentIdea,
  ContentIdeaGenerateInput,
  ContentIdeaInput,
  ContentIdeaStatusInput,
} from "@orion/types";
import { prisma } from "../db/prisma.js";

function toContentIdea(row: {
  id: string;
  userId: string;
  title: string;
  body: string;
  niche: string;
  format: string;
  status: string;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ContentIdea {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    niche: row.niche,
    format: row.format,
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const contentSelect = {
  id: true,
  userId: true,
  title: true,
  body: true,
  niche: true,
  format: true,
  status: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listContentIdeas(userId: string): Promise<ContentIdea[]> {
  const rows = await prisma.contentIdea.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 80,
    select: contentSelect,
  });
  return rows.map(toContentIdea);
}

export async function createContentIdea(userId: string, input: ContentIdeaInput): Promise<ContentIdea> {
  const row = await prisma.contentIdea.create({
    data: {
      userId,
      title: input.title.trim(),
      body: input.body.trim(),
      niche: input.niche.trim(),
      format: input.format.trim(),
      status: input.status ?? "idea",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    },
    select: contentSelect,
  });
  return toContentIdea(row);
}

export async function updateContentIdeaStatus(userId: string, id: string, input: ContentIdeaStatusInput): Promise<ContentIdea> {
  const owned = await prisma.contentIdea.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Ideia nao encontrada.");
  const row = await prisma.contentIdea.update({
    where: { id },
    data: {
      status: input.status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
    },
    select: contentSelect,
  });
  return toContentIdea(row);
}

export async function deleteContentIdea(userId: string, id: string): Promise<{ id: string }> {
  const owned = await prisma.contentIdea.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Ideia nao encontrada.");
  await prisma.contentIdea.delete({ where: { id }, select: { id: true } });
  return { id };
}

const hooks = [
  "erro que quase todo iniciante comete",
  "checklist rapido para salvar tempo",
  "antes e depois de aplicar isso",
  "mito vs realidade",
  "3 sinais de que esta na hora de mudar",
  "roteiro pratico em 30 minutos",
];

function formatLabel(format: string | undefined): string {
  return format?.trim() || "Reels";
}

export async function generateContentIdeas(userId: string, input: ContentIdeaGenerateInput): Promise<ContentIdea[]> {
  const count = Math.max(1, Math.min(6, input.count ?? 3));
  const niche = input.niche.trim();
  const format = formatLabel(input.format);
  const theme = input.theme?.trim() || niche;
  const generated = Array.from({ length: count }, (_, index) => {
    const hook = hooks[index % hooks.length];
    return {
      title: `${theme}: ${hook}`,
      body:
        `Formato: ${format}\n` +
        `Gancho: "${hook}"\n` +
        `Estrutura: abertura forte, exemplo pessoal/contextual, passo pratico, CTA para salvar ou comentar.\n` +
        `Angulo O.R.I.O.N: conectar ${niche} com rotina real, sem parecer post generico.`,
      niche,
      format,
      status: "idea",
    };
  });

  const created = await prisma.$transaction(
    generated.map((idea) =>
      prisma.contentIdea.create({
        data: { userId, ...idea },
        select: contentSelect,
      }),
    ),
  );
  return created.map(toContentIdea);
}
