import { PrismaClient } from "@prisma/client";

/**
 * Seed mínimo: 4 alertas demo + 5 projetos da Karen.
 * Roda com: npm run db:seed (a partir de apps/api).
 *
 * ATENÇÃO: este seed é idempotente — recria a Karen demo a cada execução.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const demoClerkId = "demo_karen";
  const user = await prisma.user.upsert({
    where: { clerkId: demoClerkId },
    update: {},
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

  // Projetos demo
  const projects = [
    { name: "O.R.I.O.N", progress: 25, color: "#00D4FF", status: "em_build" },
    { name: "Lumi", progress: 60, color: "#7C3AED", status: "design_ok" },
    { name: "Nexus", progress: 30, color: "#F59E0B", status: "conceito" },
    { name: "OnGeek", progress: 20, color: "#10B981", status: "ideacao" },
    { name: "@by.arwenn", progress: 45, color: "#EC4899", status: "crescendo" },
  ];
  await prisma.project.deleteMany({ where: { userId: user.id } });
  for (const p of projects) {
    await prisma.project.create({ data: { ...p, userId: user.id } });
  }

  // Alertas demo
  const alerts = [
    {
      module: "comms",
      icon: "◈",
      color: "#00D4FF",
      title: "Email não lido",
      text: "Há mensagens marcadas como urgentes. Quer que eu resuma?",
      action: "Verifica agora meus emails urgentes",
      priority: "high" as const,
    },
    {
      module: "calendar",
      icon: "⬡",
      color: "#10B981",
      title: "Agenda do dia",
      text: "3 compromissos hoje. Quer um briefing?",
      action: "Mostra minha agenda completa de hoje",
      priority: "medium" as const,
    },
    {
      module: "career",
      icon: "↑",
      color: "#F59E0B",
      title: "Carreira",
      text: "GitHub desatualizado. Plano de commits em 30 dias?",
      action: "Cria um plano de 30 dias para meu portfólio GitHub",
      priority: "medium" as const,
    },
    {
      module: "creative",
      icon: "✦",
      color: "#7C3AED",
      title: "Conteúdo @by.arwenn",
      text: "3 formatos de alta performance não usados esta semana.",
      action: "Me dá 5 ideias de conteúdo geek pra esta semana",
      priority: "low" as const,
    },
  ];
  await prisma.proactiveAlert.deleteMany({ where: { userId: user.id } });
  for (const a of alerts) {
    await prisma.proactiveAlert.create({ data: { ...a, userId: user.id } });
  }

  console.log(`◉ Seed concluído. Usuário demo: ${user.email}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
