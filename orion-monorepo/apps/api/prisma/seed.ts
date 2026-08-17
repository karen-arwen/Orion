import { PrismaClient } from "@prisma/client";

/**
 * Seed completo: usuário demo + todos os módulos populados.
 * Roda com: npm run db:seed (a partir de apps/api).
 * Idempotente — limpa e recria a cada execução.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const demoClerkId = "demo_karen";

  // ── USUÁRIO ──────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { clerkId: demoClerkId },
    update: { name: "Karen Arwen", mode: "STARK" },
    create: {
      clerkId: demoClerkId,
      email: "karen@orion.local",
      name: "Karen Arwen",
      avatar: "KA",
      avatarColor: "#7C3AED",
      mode: "STARK",
      profile: {
        create: {
          bio: "Full stack dev intern, influenciadora geek @by.arwenn, Indaiatuba. Projetos: Lumi, Nexus, OnGeek.",
          themePrimary: "#00D4FF",
          themeSecondary: "#7C3AED",
          themeAccent: "#F59E0B",
        },
      },
    },
  });
  console.log(`◉ Usuário: ${user.email}`);

  // ── PROJETOS ─────────────────────────────────────────────────────
  await prisma.project.deleteMany({ where: { userId: user.id } });
  const projectDefs = [
    { name: "O.R.I.O.N", progress: 38, color: "#00D4FF", status: "em_build" },
    { name: "Lumi", progress: 65, color: "#7C3AED", status: "design_ok" },
    { name: "Nexus", progress: 12, color: "#F59E0B", status: "conceito" },
    { name: "OnGeek", progress: 50, color: "#10B981", status: "crescendo" },
    { name: "@by.arwenn", progress: 72, color: "#EC4899", status: "crescendo" },
  ];
  for (const p of projectDefs) {
    await prisma.project.create({ data: { ...p, userId: user.id } });
  }
  console.log(`◉ Projetos: ${projectDefs.length}`);

  // ── TAREFAS (Life OS) ────────────────────────────────────────────
  await prisma.task.deleteMany({ where: { userId: user.id } });
  const tasks = [
    { title: "Terminar autenticação do ORION", priority: 3, energy: 3, status: "todo" as const },
    { title: "Publicar post sobre React Server Components", priority: 2, energy: 2, status: "todo" as const },
    { title: "Estudar TypeScript generics avançados", priority: 2, energy: 3, status: "doing" as const, isRecurring: true, recurrenceRule: "weekdays" },
    { title: "Ler capítulo do livro técnico", priority: 1, energy: 1, status: "todo" as const, isRecurring: true, recurrenceRule: "daily" },
    { title: "Organizar issues do GitHub - Lumi", priority: 2, energy: 2, status: "done" as const },
    { title: "Criar sistema de notificações do Nexus", priority: 3, energy: 3, status: "todo" as const },
    { title: "Revisar portfólio - by.arwenn", priority: 1, energy: 1, status: "todo" as const },
  ];
  for (const t of tasks) {
    await prisma.task.create({ data: { ...t, userId: user.id } });
  }
  console.log(`◉ Tarefas: ${tasks.length}`);

  // ── HÁBITOS ──────────────────────────────────────────────────────
  await prisma.habit.deleteMany({ where: { userId: user.id } });
  const habits = [
    { name: "Água (2L)", frequency: "daily", color: "#00D4FF", icon: "💧", streak: 12, bestStreak: 21 },
    { name: "Exercício", frequency: "daily", color: "#10B981", icon: "🏃", streak: 5, bestStreak: 14 },
    { name: "Código (1h)", frequency: "daily", color: "#7C3AED", icon: "💻", streak: 18, bestStreak: 30 },
    { name: "Leitura técnica", frequency: "daily", color: "#F59E0B", icon: "📚", streak: 7, bestStreak: 20 },
    { name: "Sem redes sociais antes das 10h", frequency: "daily", color: "#EC4899", icon: "📵", streak: 3, bestStreak: 10 },
    { name: "Meditação", frequency: "daily", color: "#06B6D4", icon: "🧘", streak: 0, bestStreak: 8 },
  ];
  const today = new Date().toISOString().split("T")[0];
  for (const h of habits) {
    const habit = await prisma.habit.create({ data: { ...h, userId: user.id } });
    // Checks dos últimos dias
    const checksCount = h.streak > 0 ? Math.min(h.streak, 7) : 0;
    for (let i = 0; i < checksCount; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      await prisma.habitLog.upsert({
        where: { habitId_date: { habitId: habit.id, date: dateStr } },
        update: {},
        create: { habitId: habit.id, date: dateStr },
      });
    }
  }
  console.log(`◉ Hábitos: ${habits.length}`);

  // ── ROTINAS ──────────────────────────────────────────────────────
  await prisma.routine.deleteMany({ where: { userId: user.id } });
  const routinesData = [
    {
      name: "Manhã Stark",
      type: "morning",
      description: "Rotina matinal de alta performance",
      steps: [
        { title: "Água gelada + alongamento", durationMin: 5, icon: "💧", order: 0 },
        { title: "Journal de manhã (3 gratidões)", durationMin: 10, icon: "📓", order: 1 },
        { title: "Revisar tarefas do dia", durationMin: 5, icon: "✅", order: 2 },
        { title: "Código - foco profundo", durationMin: 60, icon: "💻", order: 3 },
        { title: "Revisar emails importantes", durationMin: 10, icon: "📧", order: 4 },
      ],
    },
    {
      name: "Noite de Descompressão",
      type: "evening",
      description: "Encerrar o dia com qualidade",
      steps: [
        { title: "Fechar todas as abas e apps", durationMin: 5, icon: "🔒", order: 0 },
        { title: "Review do dia - o que funcionou?", durationMin: 10, icon: "🔍", order: 1 },
        { title: "Planejar top 3 de amanhã", durationMin: 5, icon: "📋", order: 2 },
        { title: "Leitura (sem tela)", durationMin: 30, icon: "📚", order: 3 },
      ],
    },
    {
      name: "Deploy Friday",
      type: "custom",
      description: "Checklist antes de fazer merge",
      steps: [
        { title: "Rodar testes locais", durationMin: 5, icon: "🧪", order: 0 },
        { title: "Checar variáveis de ambiente", durationMin: 3, icon: "⚙️", order: 1 },
        { title: "Code review próprio", durationMin: 10, icon: "👁️", order: 2 },
        { title: "Deploy e monitorar logs", durationMin: 15, icon: "🚀", order: 3 },
      ],
    },
  ];
  for (const r of routinesData) {
    const { steps, ...routineFields } = r;
    const routine = await prisma.routine.create({ data: { ...routineFields, userId: user.id } });
    for (const s of steps) {
      await prisma.routineStep.create({ data: { ...s, routineId: routine.id } });
    }
  }
  console.log(`◉ Rotinas: ${routinesData.length}`);

  // ── JOURNAL ENTRIES (UserPattern) ────────────────────────────────
  await prisma.userPattern.deleteMany({
    where: { userId: user.id, patternType: { startsWith: "journal_" } },
  });
  const journalEntries = [
    {
      daysAgo: 0,
      mood: 4, energy: 4,
      gratitude: ["Finalmente fiz o auth funcionar", "Clima agradável hoje", "Feedback positivo no PR"],
      highlight: "Resolvi um bug que me travou 2 dias — sensação de Dopamina pura",
      challenge: "Procrastinei na parte de CSS, difícil manter foco visual",
      reflection: "Preciso separar tempo de design do tempo de código. São cérebros diferentes.",
      intentions: ["Terminar a DashboardPage", "Fazer PR do módulo de hábitos", "Sair das telas às 22h"],
      tags: ["código", "foco", "orion"],
    },
    {
      daysAgo: 1,
      mood: 3, energy: 3,
      gratitude: ["Café bom de manhã", "Call produtiva com mentor", "Aprendi sobre generics"],
      highlight: "Entendi finalmente como TypeScript generics funcionam na prática",
      challenge: "Energia baixa depois do almoço, precisei forçar o foco",
      reflection: "Sono ruim afeta tudo. Dormir cedo é uma decisão técnica.",
      intentions: ["Resolver o bug do Prisma", "Começar módulo de Journal", "Dormir antes das 23h"],
      tags: ["typescript", "aprendizado", "sono"],
    },
    {
      daysAgo: 2,
      mood: 5, energy: 5,
      gratitude: ["Dia de alta produtividade", "Feature entregue no prazo", "Review positivo"],
      highlight: "Entreguei a página de Projetos completa — timeline, milestones, stall detection",
      challenge: "Nada bloqueante hoje, foi flow state quase o dia todo",
      reflection: "Quando o ambiente está organizado e sem distrações, o output é 3x maior.",
      intentions: ["Manter o ritmo amanhã", "Code review dos PRs pendentes", "Publicar update no Twitter"],
      tags: ["produtividade", "flow", "orion", "entrega"],
    },
    {
      daysAgo: 4,
      mood: 2, energy: 2,
      gratitude: ["Mesmo assim terminei uma tarefa", "Família bem", "Projeto avançou um pouco"],
      highlight: "Consegui fazer pelo menos uma coisa útil apesar do dia difícil",
      challenge: "Ansiedade sobre prazo do projeto Lumi. Parece que vai atrasar.",
      reflection: "Dias ruins existem. O importante é não quebrar a sequência completamente.",
      intentions: ["Conversar com o time sobre o prazo", "Focar no que posso controlar", "Exercício amanhã cedo"],
      tags: ["ansiedade", "resiliência", "lumi"],
    },
  ];
  for (const e of journalEntries) {
    const d = new Date();
    d.setDate(d.getDate() - e.daysAgo);
    const date = d.toISOString().split("T")[0];
    const { daysAgo: _, ...entryData } = e;
    await prisma.userPattern.upsert({
      where: { userId_patternType: { userId: user.id, patternType: `journal_entry_${date}` } },
      update: { data: { ...entryData, date, createdAt: d.toISOString(), updatedAt: new Date().toISOString() } as never },
      create: {
        userId: user.id,
        patternType: `journal_entry_${date}`,
        data: { ...entryData, date, createdAt: d.toISOString(), updatedAt: new Date().toISOString() } as never,
      },
    });
  }
  // Streak
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId: user.id, patternType: "journal_streak" } },
    update: { data: 3 as never },
    create: { userId: user.id, patternType: "journal_streak", data: 3 as never },
  });
  console.log(`◉ Journal: ${journalEntries.length} entradas`);

  // ── PROJETOS COM MILESTONES (UserPattern) ────────────────────────
  const projectList = await prisma.project.findMany({ where: { userId: user.id } });
  const orionProject = projectList.find(p => p.name === "O.R.I.O.N");
  if (orionProject) {
    const milestones = [
      { id: "ms1", title: "Auth com Clerk", completed: true, completedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
      { id: "ms2", title: "Módulos core (COMMS, AGENDA, LIFE)", completed: true, completedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: "ms3", title: "Chat com Claude API", completed: true, completedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
      { id: "ms4", title: "Dashboard inteligente", completed: false },
      { id: "ms5", title: "Deploy Vercel + Railway", completed: false },
      { id: "ms6", title: "Beta fechado com 10 usuários", completed: false },
    ];
    await prisma.userPattern.deleteMany({
      where: { userId: user.id, patternType: { startsWith: `project_ms_${orionProject.id}` } },
    });
    for (const ms of milestones) {
      await prisma.userPattern.create({
        data: {
          userId: user.id,
          patternType: `project_ms_${orionProject.id}_${ms.id}`,
          data: ms as never,
        },
      });
    }
  }
  console.log(`◉ Milestones: criados para O.R.I.O.N`);

  // ── QUESTS (UserPattern) ─────────────────────────────────────────
  await prisma.userPattern.deleteMany({
    where: { userId: user.id, patternType: { startsWith: "quest_" } },
  });
  const questProgress = [
    { questId: "q_first_commit", patternType: "quest_q_first_commit", data: { progress: 1, completed: true, completedAt: new Date(Date.now() - 30 * 86400000).toISOString() } },
    { questId: "q_streak_7", patternType: "quest_q_streak_7", data: { progress: 7, completed: true, completedAt: new Date(Date.now() - 5 * 86400000).toISOString() } },
    { questId: "q_projects_3", patternType: "quest_q_projects_3", data: { progress: 5, completed: true, completedAt: new Date(Date.now() - 2 * 86400000).toISOString() } },
    { questId: "q_journal_7", patternType: "quest_q_journal_7", data: { progress: 4, completed: false } },
    { questId: "q_habits_30", patternType: "quest_q_habits_30", data: { progress: 18, completed: false } },
  ];
  for (const q of questProgress) {
    await prisma.userPattern.create({
      data: { userId: user.id, patternType: q.patternType, data: q.data as never },
    });
  }
  // XP e nível
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId: user.id, patternType: "user_xp" } },
    update: { data: 2340 as never },
    create: { userId: user.id, patternType: "user_xp", data: 2340 as never },
  });
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId: user.id, patternType: "user_level" } },
    update: { data: 8 as never },
    create: { userId: user.id, patternType: "user_level", data: 8 as never },
  });
  console.log(`◉ Quest XP: 2340 XP, nível 8`);

  // ── ALERTAS ──────────────────────────────────────────────────────
  await prisma.proactiveAlert.deleteMany({ where: { userId: user.id } });
  const alerts = [
    {
      module: "comms",
      icon: "◈",
      color: "#00D4FF",
      title: "3 emails urgentes não lidos",
      text: "Há mensagens marcadas como urgentes. Quer que eu resuma?",
      action: "Verifica agora meus emails urgentes",
      priority: "high" as const,
    },
    {
      module: "habits",
      icon: "◎",
      color: "#10B981",
      title: "Meditação com streak zerado",
      text: "Você não medita há 3 dias. Quer reagendar nos próximos 7 dias?",
      action: "Me ajuda a criar um plano para voltar a meditar",
      priority: "medium" as const,
    },
    {
      module: "projects",
      icon: "⬡",
      color: "#F59E0B",
      title: "Nexus parado há 9 dias",
      text: "O projeto Nexus não tem atividade. Quer um plano de desbloqueio?",
      action: "O que eu devo fazer para desbloquear o projeto Nexus?",
      priority: "medium" as const,
    },
    {
      module: "career",
      icon: "↑",
      color: "#7C3AED",
      title: "GitHub: 4 dias sem commits",
      text: "Sua consistência está caindo. Que tal um micro-commit hoje?",
      action: "Sugere algo pequeno mas impactante que eu possa commitar hoje",
      priority: "low" as const,
    },
    {
      module: "journal",
      icon: "✦",
      color: "#EC4899",
      title: "Entrada do diário pendente",
      text: "São 21h e você ainda não registrou o dia de hoje.",
      action: "Me faz 3 perguntas para eu registrar como foi meu dia",
      priority: "low" as const,
    },
  ];
  for (const a of alerts) {
    await prisma.proactiveAlert.create({ data: { ...a, userId: user.id } });
  }
  console.log(`◉ Alertas: ${alerts.length}`);

  // ── EVENTOS DE CALENDÁRIO ────────────────────────────────────────
  await prisma.calendarEvent.deleteMany({ where: { userId: user.id } });
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const calEvents = [
    { externalId: "seed_evt_1", source: "google", title: "Sync semanal - ORION",
      startTime: new Date(todayStart.getTime() + 10 * 3600000), endTime: new Date(todayStart.getTime() + 11 * 3600000) },
    { externalId: "seed_evt_2", source: "google", title: "Review de código - Lumi",
      startTime: new Date(todayStart.getTime() + 14 * 3600000), endTime: new Date(todayStart.getTime() + 15 * 3600000) },
    { externalId: "seed_evt_3", source: "google", title: "Publicar post @by.arwenn",
      startTime: new Date(todayStart.getTime() + 18 * 3600000), endTime: new Date(todayStart.getTime() + 18.5 * 3600000) },
  ];
  for (const e of calEvents) {
    await prisma.calendarEvent.upsert({
      where: { userId_externalId_source: { userId: user.id, externalId: e.externalId, source: e.source } },
      update: {},
      create: { ...e, userId: user.id },
    });
  }
  console.log(`◉ Calendário: ${calEvents.length} eventos hoje`);

  console.log(`\n✦ ORION seed concluído. Acesse http://localhost:5173`);
  console.log(`  Usuário demo: ${user.email} (clerkId: ${demoClerkId})`);
  console.log(`  Para usar via API: POST /v1/auth/demo (não implementado em prod)`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
