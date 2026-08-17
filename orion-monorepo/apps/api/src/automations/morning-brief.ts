import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { getBehavioralProfile } from "../modules/behavioral-profile.service.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function buildBriefPrompt(tone: "direct" | "elaborate" | "casual" | "unknown"): string {
  const toneGuide: Record<string, string> = {
    direct:    "Seja ultra-direto. 3-4 bullets no maximo. Sem introducao. Vai direto as prioridades.",
    elaborate: "Pode dar mais contexto. 4-6 linhas. Explique brevemente o porque de cada prioridade.",
    casual:    "Tom descontraido mas profissional. Como um amigo bem informado te contando o dia.",
    unknown:   "Tom equilibrado — direto mas nao frio. 3-5 linhas.",
  };

  return `Voce e O.R.I.O.N. gerando o Morning Brief do dia pro usuario.

ESTILO: ${toneGuide[tone] ?? toneGuide.unknown}

Voce tem o snapshot completo da manha (agenda, emails urgentes, projetos, alertas, memorias).

ESTRUTURA:
1. Abertura: 1 frase com a leitura geral do dia (denso? tranquilo? critico?)
2. Prioridades: 2-4 itens concretos baseados em dados reais do snapshot
3. Pergunta de acao: 1 pergunta especifica convidando o proximo passo

REGRAS:
- Use dados reais do contexto. NUNCA invente informacoes.
- Se nao ha eventos ou emails urgentes, diga isso com clareza.
- Termine sempre com uma acao proposta concreta.
- Portugues BR natural, sem jargao corporativo.
- NAO use markdown (sem **, sem #). Texto corrido.`;
}

async function generateBrief(userId: string): Promise<string | null> {
  const [snap, behavioral] = await Promise.all([
    captureBrainSnapshot(userId).catch(() => null),
    getBehavioralProfile(userId).catch(() => null),
  ]);

  if (!snap) return null;

  const ctx = renderBrainContext(snap);
  const tone = (behavioral?.communicationStyle ?? "unknown") as "direct" | "elaborate" | "casual" | "unknown";

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 400,
    temperature: 0.65,
    system: buildBriefPrompt(tone),
    messages: [{ role: "user", content: `Estado da manha:\n${ctx}` }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text || null;
}

export async function runMorningBriefFor(userId: string): Promise<void> {
  try {
    const brief = await generateBrief(userId);
    if (!brief) return;

    const today = new Date().toISOString().slice(0, 10);
    const dedupKey = `morning_brief_${today}`;
    const titleDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });

    await prisma.proactiveAlert.upsert({
      where: { userId_dedupKey: { userId, dedupKey } },
      create: {
        userId,
        module: "morning_brief",
        icon: "◐",
        color: "#F59E0B",
        title: `Morning Brief · ${titleDate}`,
        text: brief,
        action: "Responder no chat",
        priority: "medium",
        dedupKey,
        expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
      update: {
        text: brief,
        title: `Morning Brief · ${titleDate}`,
      },
    });

    // Injeta no historico de chat para aparecer proativamente
    const conv = await prisma.conversation.findFirst({
      where: { userId, moduleId: null },
      orderBy: { updatedAt: "desc" },
    }).catch(() => null);

    if (conv) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: "assistant",
          content: `[MORNING BRIEF]\n\n${brief}`,
        },
      }).catch(() => {});
    }

    console.log(`[brief] gerado pra ${userId}: ${brief.slice(0, 80)}...`);
  } catch (err) {
    console.warn(`[brief] falhou pra ${userId}:`, (err as Error).message);
  }
}

export async function runMorningBriefAll(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { integrations: { some: { status: "connected" } } },
    select: { id: true },
  });
  console.log(`[brief] rodando pra ${users.length} usuarios`);
  for (const user of users) {
    await runMorningBriefFor(user.id).catch(() => {});
  }
}
