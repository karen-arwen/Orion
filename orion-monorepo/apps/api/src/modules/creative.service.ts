import Anthropic from "@anthropic-ai/sdk";
import type { IdeaCreateInput, IdeaStatus } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   CRIAÇÃO — Banco de ideias + gerador via IA.
   Kanban: ideia → rascunho → agendado → publicado
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const IDEA_GEN_SYSTEM = `Voce e o O.R.I.O.N. em modo CRIACAO/PROJETOS.

O usuario quer gerar IDEIAS e PROJETOS. Isso pode ser:
- Conteudo (reels, posts, videos) SE o nicho for criacao de conteudo
- Projetos profissionais (Salesforce, desenvolvimento, consultoria) SE for dev/tech
- Projetos criativos (arte, musica, design) SE for criativo
- Qualquer outro tipo de projeto baseado no nicho informado

REGRA ABSOLUTA: leia o nicho do usuario e gere ideias EXCLUSIVAMENTE nesse dominio.
Se o nicho e "salesforce" ou "desenvolvimento", gere projetos de Salesforce/dev.
Se e "ugc" ou "conteudo", gere ideias de conteudo.
NUNCA misture nichos. Se o usuario fala de Salesforce, NAO sugira UGC, programacao generica, I.A., ou rotina dev junior.

Devolva APENAS JSON puro, sem markdown:
[
  {
    "title": "titulo do projeto/ideia (max 80 chars)",
    "body": "descricao + estrutura sugerida (3-5 linhas)",
    "format": "projeto | app | consultoria | automacao | curso | reels | tiktok | carrossel | tutorial | blog | video",
    "tags": ["tag1", "tag2"]
  }
]

REGRAS:
- 5 ideias, tipos VARIADOS.
- Cada ideia deve ser DIRETAMENTE relacionada ao nicho informado.
- Inclua detalhes concretos (tecnologias, ferramentas, numeros).
- Se nao tem nicho especifico, pergunte antes de gerar.`;

export async function listIdeas(userId: string): Promise<unknown[]> {
  return prisma.contentIdea.findMany({
    where: { userId, status: { not: "arquivado" } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function createIdea(userId: string, input: IdeaCreateInput): Promise<unknown> {
  return prisma.contentIdea.create({
    data: {
      userId,
      title: input.title,
      body: input.body ?? null,
      niche: input.niche ?? "geral",
      format: input.format ?? "reels",
      status: (input.status as IdeaStatus) ?? "ideia",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      tags: input.tags ?? [],
    },
  });
}

export async function updateIdea(
  userId: string,
  id: string,
  patch: Partial<IdeaCreateInput>,
): Promise<unknown> {
  const owned = await prisma.contentIdea.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Ideia não encontrada");
  return prisma.contentIdea.update({
    where: { id },
    data: {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.body !== undefined && { body: patch.body }),
      ...(patch.niche !== undefined && { niche: patch.niche }),
      ...(patch.format !== undefined && { format: patch.format }),
      ...(patch.status !== undefined && { status: patch.status as IdeaStatus }),
      ...(patch.scheduledAt !== undefined && {
        scheduledAt: patch.scheduledAt ? new Date(patch.scheduledAt) : null,
      }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
    },
  });
}

export async function deleteIdea(userId: string, id: string): Promise<void> {
  const owned = await prisma.contentIdea.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Ideia não encontrada");
  await prisma.contentIdea.delete({ where: { id } });
}

/** Gera 5 ideias via IA — opcionalmente já salva como "ideia" no banco. */
export async function generateIdeas(opts: {
  userId: string;
  niche?: string;
  audience?: string;
  save?: boolean;
}): Promise<Array<{ title: string; body: string; format: string; tags: string[] }>> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    include: { profile: true, projects: { take: 5 } },
  });
  const niche = opts.niche ?? "geral";

  const ctx = [
    `Usuário: ${user?.name ?? "—"}`,
    user?.profile?.bio ? `Bio: ${user.profile.bio}` : null,
    user?.projects?.length ? `Projetos: ${user.projects.map((p) => p.name).join(", ")}` : null,
    opts.audience ? `Audiência: ${opts.audience}` : null,
    `Nicho-foco: ${niche}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1500,
    temperature: 0.85,
    system: IDEA_GEN_SYSTEM,
    messages: [{ role: "user", content: ctx }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed: Array<{ title: string; body: string; format: string; tags: string[] }> = [];
  try {
    const j = JSON.parse(text) as unknown;
    if (Array.isArray(j)) parsed = j as typeof parsed;
  } catch {
    return [];
  }

  if (opts.save && parsed.length > 0) {
    await prisma.contentIdea.createMany({
      data: parsed.map((p) => ({
        userId: opts.userId,
        title: p.title.slice(0, 200),
        body: p.body,
        niche,
        format: p.format ?? "reels",
        status: "ideia" as IdeaStatus,
        tags: p.tags ?? [],
      })),
    });
  }

  return parsed;
}
