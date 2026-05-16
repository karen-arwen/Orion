import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";

/* ═══════════════════════════════════════════════════════════════════
   Morning Brief — autonomia real.

   Todo dia útil às 8h (timezone do usuário aproximado), pra cada
   usuário com Gmail + Calendar conectados:
     1. Captura snapshot do mundo do usuário
     2. Gera briefing executivo com Claude
     3. Cria ProactiveAlert no banco

   Quando o usuário abre o O.R.I.O.N., o alerta já está lá esperando.
   Não é o usuário pedindo — é o Jarvis agindo.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const BRIEF_PROMPT = `Você é o O.R.I.O.N. gerando um Morning Brief pro usuário.

Estilo: sofisticado, conciso, levemente dramático. Português BR fluido.
NÃO use markdown extenso. Texto corrido, parágrafos curtos.

Você tem o snapshot da manhã (agenda, emails, projetos, memórias).

Estrutura ideal (3-6 linhas no total):
- Saudação curta com leitura do dia
- 2-3 prioridades concretas baseadas em agenda + emails
- Pergunta final convidando ação ("Quer que eu prepare X?")

NÃO repita os dados crus. SINTETIZE e PRIORIZE.`;

async function generateBrief(userId: string): Promise<string | null> {
  const snap = await captureBrainSnapshot(userId);
  const ctx = renderBrainContext(snap);

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 500,
    temperature: 0.7,
    system: BRIEF_PROMPT,
    messages: [{ role: "user", content: ctx }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || null;
}

/** Gera briefing pra um usuário e salva como alerta proativo. */
export async function runMorningBriefFor(userId: string): Promise<void> {
  try {
    const brief = await generateBrief(userId);
    if (!brief) return;

    await prisma.proactiveAlert.create({
      data: {
        userId,
        module: "morning_brief",
        icon: "◐",
        color: "#F59E0B",
        title: "Morning Brief",
        text: brief,
        action: "Vamos atacar essa lista agora",
        priority: "medium",
      },
    });
    console.log(`[brief] gerado pra ${userId}: ${brief.slice(0, 80)}…`);
  } catch (err) {
    console.warn(`[brief] falhou pra ${userId}:`, (err as Error).message);
  }
}

/** Roda pra TODOS os usuários elegíveis (Gmail + Calendar conectados). */
export async function runMorningBriefAll(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      integrations: {
        some: { provider: "gmail", status: "connected" },
      },
    },
    select: { id: true, name: true },
  });

  console.log(`[brief] disparando pra ${users.length} usuário(s) elegível(eis)`);
  for (const u of users) {
    await runMorningBriefFor(u.id);
  }
}
