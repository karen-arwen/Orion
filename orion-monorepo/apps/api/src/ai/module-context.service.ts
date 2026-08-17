import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   MODULE CONTEXT — enriquece o system prompt quando o chat está
   dentro de um módulo específico.

   Quando o usuário está em /m/finance e fala no chat, o ORION
   recebe dados reais do módulo financeiro como contexto.
═══════════════════════════════════════════════════════════════════ */

export async function getModuleContext(userId: string, moduleId: string | null | undefined): Promise<string | undefined> {
  if (!moduleId) return undefined;

  try {
    switch (moduleId) {
      case "finance": {
        const [transactions, goals, subscriptions] = await Promise.all([
          prisma.financeTransaction.findMany({
            where: { userId },
            orderBy: { occurredAt: "desc" },
            take: 10,
          }),
          prisma.financeGoal.findMany({ where: { userId } }),
          prisma.financeSubscription.findMany({ where: { userId, active: true } }),
        ]);
        const totalSubs = subscriptions.reduce((s, sub) => s + sub.amount, 0);
        const recentSpend = transactions
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return [
          `Modulo: CFO PESSOAL (finance)`,
          `Transacoes recentes: ${transactions.length} (gasto total recente: R$ ${recentSpend.toFixed(2)})`,
          `Metas financeiras: ${goals.length} ativas`,
          `Assinaturas: ${subscriptions.length} (total mensal: R$ ${totalSubs.toFixed(2)})`,
          transactions.slice(0, 5).map((t) => `  - ${t.occurredAt.toLocaleDateString("pt-BR")}: ${t.category} R$ ${t.amount.toFixed(2)} ${t.note || ""}`).join("\n"),
        ].join("\n");
      }

      case "habits": {
        const habits = await prisma.habit.findMany({
          where: { userId, archivedAt: null },
          include: { logs: { orderBy: { createdAt: "desc" }, take: 7 } },
        });
        return [
          `Modulo: HABITOS`,
          `${habits.length} habitos ativos:`,
          ...habits.map((h) => `  - ${h.name}: streak=${h.streak}, melhor=${h.bestStreak}, logs recentes=${h.logs.length}/7`),
        ].join("\n");
      }

      case "life": {
        const tasks = await prisma.task.findMany({
          where: { userId, status: { in: ["todo", "doing"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        return [
          `Modulo: LIFE OS`,
          `${tasks.length} tarefas abertas:`,
          ...tasks.map((t) => `  - [P${t.priority}][${t.status}] ${t.title}${t.dueAt ? ` (vence ${t.dueAt.toLocaleDateString("pt-BR")})` : ""}`),
        ].join("\n");
      }

      case "sleep": {
        const logs = await prisma.sleepLog.findMany({
          where: { userId },
          orderBy: { bedTime: "desc" },
          take: 7,
        });
        return [
          `Modulo: SONO`,
          `Ultimos ${logs.length} registros:`,
          ...logs.map((l) => {
            const hrs = l.wakeTime && l.bedTime
              ? ((l.wakeTime.getTime() - l.bedTime.getTime()) / 3600000).toFixed(1)
              : "?";
            return `  - ${l.bedTime.toLocaleDateString("pt-BR")}: ${hrs}h, qualidade ${l.quality ?? "?"}/5`;
          }),
        ].join("\n");
      }

      case "focus": {
        const sessions = await prisma.focusSession.findMany({
          where: { userId, startedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
          orderBy: { startedAt: "desc" },
          take: 10,
        });
        const completed = sessions.filter((s) => s.completed).length;
        const totalMin = sessions.reduce((s, f) => s + (f.actualMinutes ?? f.duration), 0);
        return [
          `Modulo: FOCO`,
          `Ultimos 7 dias: ${sessions.length} sessoes (${completed} completas), ${totalMin} min total`,
        ].join("\n");
      }

      case "social": {
        const contacts = await prisma.socialContact.findMany({
          where: { userId },
          orderBy: { importance: "desc" },
          take: 10,
        });
        return [
          `Modulo: CRM PESSOAL (social)`,
          `${contacts.length} contatos:`,
          ...contacts.map((c) => `  - ${c.name} (importancia: ${c.importance}) ultimo contato: ${c.lastInteraction?.toLocaleDateString("pt-BR") ?? "nunca"}`),
        ].join("\n");
      }

      case "security": {
        const [accounts, findings] = await Promise.all([
          prisma.securityAccount.findMany({ where: { userId }, take: 10 }),
          prisma.securityFinding.findMany({
            where: { userId, resolved: false },
            take: 5,
          }),
        ]);
        return [
          `Modulo: SEGURANCA`,
          `${accounts.length} contas monitoradas, ${findings.length} findings abertos`,
          ...findings.map((f) => `  - [${f.risk}] ${f.title}`),
        ].join("\n");
      }

      case "mindset": {
        const checkins = await prisma.mindsetCheckin.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        return [
          `Modulo: MINDSET`,
          `Ultimos check-ins:`,
          ...checkins.map((c) => `  - ${c.createdAt.toLocaleDateString("pt-BR")}: humor=${c.mood}, energia=${c.energy}`),
        ].join("\n");
      }

      case "media": {
        const items = await prisma.mediaItem.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
        return [
          `Modulo: MIDIA`,
          `${items.length} itens recentes:`,
          ...items.map((m) => `  - [${m.kind}][${m.status}] ${m.title} (${m.rating ? m.rating + "/10" : "sem nota"})`),
        ].join("\n");
      }

      case "shop": {
        const items = await prisma.wishlistItem.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        return [
          `Modulo: COMPRAS`,
          `${items.length} itens na wishlist:`,
          ...items.map((w) => `  - ${w.name}: R$ ${w.currentPrice?.toFixed(2) ?? "?"} (meta: R$ ${w.targetPrice?.toFixed(2) ?? "?"})`),
        ].join("\n");
      }

      case "chef": {
        const recipes = await prisma.recipe.findMany({
          where: { userId },
          orderBy: { savedAt: "desc" },
          take: 5,
        });
        return [
          "Modulo: CHEF PESSOAL",
          `${recipes.length} receitas salvas recentemente`,
          ...recipes.map((r) => `  - ${r.title} (${r.prepMinutes}min, ${r.servings} porcoes)`),
          "Voce pode sugerir receitas baseadas nos ingredientes que o usuario tem.",
        ].join("\n");
      }

      case "career": {
        const projects = await prisma.project.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
        });
        const memories = await prisma.memory.findMany({
          where: { userId, type: { in: ["fact", "preference"] } },
          orderBy: { importance: "desc" },
          take: 5,
        });
        return [
          "Modulo: CARREIRA",
          projects.length > 0 ? `Projetos: ${projects.map((p) => `${p.name} (${p.progress}%)`).join(", ")}` : "Sem projetos cadastrados",
          memories.length > 0 ? `Contexto: ${memories.map((m) => m.content.slice(0, 80)).join(" | ")}` : "",
        ].filter(Boolean).join("\n");
      }

      case "know": {
        const lessons = await prisma.lessonSession.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
        });
        return [
          "Modulo: CONHECIMENTO",
          `${lessons.length} aulas recentes:`,
          ...lessons.map((l) => `  - ${l.topic} (${l.level})`),
        ].join("\n");
      }

      case "creative": {
        const ideas = await prisma.contentIdea.findMany({
          where: { userId, status: { not: "arquivado" } },
          orderBy: { createdAt: "desc" },
          take: 8,
        });
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        return [
          "Modulo: CRIACAO",
          profile?.bio ? `Bio do usuario: ${profile.bio}` : "",
          `${ideas.length} ideias ativas:`,
          ...ideas.map((i) => `  - [${i.status}] ${i.title} (${i.format}, nicho: ${i.niche})`),
        ].filter(Boolean).join("\n");
      }

      case "travel": {
        return "Modulo: VIAGENS - Pode gerar roteiros, buscar voos e organizar logistica de viagem.";
      }

      case "comms": {
        return "Modulo: COMUNICACOES - Resumir emails, rascunhar respostas, priorizar mensagens.";
      }

      case "agenda": {
        return "Modulo: AGENDA - Organizar eventos, sugerir blocos de foco, detectar conflitos.";
      }

      case "health": {
        const energyLogs = await prisma.energyLog.findMany({
          where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
          orderBy: { createdAt: "desc" },
        });
        const avg = energyLogs.length > 0
          ? (energyLogs.reduce((s, e) => s + e.value, 0) / energyLogs.length).toFixed(1)
          : "sem dados";
        return [
          "Modulo: SAUDE",
          `Energia media hoje: ${avg} (${energyLogs.length} registros)`,
        ].join("\n");
      }

      case "gaming": {
        const games = await prisma.gameEntry.findMany({
          where: { userId, status: "playing" },
          take: 5,
        });
        return [
          "Modulo: GAMING",
          `Jogando agora: ${games.length > 0 ? games.map((g) => g.title).join(", ") : "nenhum jogo ativo"}`,
        ].join("\n");
      }

      case "language": {
        return "Modulo: IDIOMAS - Praticar idiomas com correcao, drills e sugestoes de conteudo.";
      }

      case "docs": {
        return "Modulo: DOCUMENTOS - Gerar, analisar e resumir documentos.";
      }

      default:
        return `Modulo ativo: ${moduleId}`;
    }
  } catch (err) {
    console.warn(`[module-context] falhou para ${moduleId}:`, (err as Error).message);
    return `Modulo ativo: ${moduleId} (dados indisponiveis)`;
  }
}
