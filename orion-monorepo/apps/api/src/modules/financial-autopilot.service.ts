import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   FINANCIAL AUTOPILOT — categorização automática + alertas de limite.

   O ORION monitora gastos e:
   - Categoriza transações sem categoria automaticamente
   - Alerta quando se aproxima do limite mensal de uma categoria
   - Calcula burn rate e projeção de fim de mês
   - Detecta assinaturas duplicadas ou não usadas
═══════════════════════════════════════════════════════════════════ */

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /uber|99|cabify|lyft/i, category: "transporte" },
  { pattern: /ifood|rappi|uber eats|deliveroo/i, category: "delivery" },
  { pattern: /netflix|spotify|disney|hbo|prime video|youtube/i, category: "streaming" },
  { pattern: /mercado|carrefour|p[aã]o de a[cç][uú]car|extra|atacad[aã]o/i, category: "mercado" },
  { pattern: /farmacia|drogaria|droga raia|drogasil/i, category: "saude" },
  { pattern: /academia|smart fit|gympass|totalpass/i, category: "fitness" },
  { pattern: /restaurante|bar|lanchonete|padaria|cafeteria/i, category: "alimentacao" },
  { pattern: /aws|vercel|railway|heroku|digital ocean|cloudflare/i, category: "infraestrutura" },
  { pattern: /github|figma|notion|slack|linear|jetbrains/i, category: "ferramentas" },
  { pattern: /aluguel|condominio|iptu|energia|agua|gas|internet/i, category: "moradia" },
  { pattern: /gasolina|estacionamento|pedagio|oficina/i, category: "carro" },
];

/** Categoriza automaticamente transações sem categoria */
export async function autoCategorize(userId: string): Promise<{ categorized: number }> {
  const uncategorized = await prisma.financeTransaction.findMany({
    where: { userId, category: "" },
    take: 50,
  });

  let categorized = 0;
  for (const tx of uncategorized) {
    const text = `${tx.merchant} ${tx.note}`.toLowerCase();
    const match = CATEGORY_RULES.find((r) => r.pattern.test(text));
    if (match) {
      await prisma.financeTransaction.update({
        where: { id: tx.id },
        data: { category: match.category },
      });
      categorized++;
    }
  }

  return { categorized };
}

/** Calcula gastos por categoria no mês atual */
export async function getMonthlyCategorySpend(userId: string): Promise<Array<{
  category: string;
  spent: number;
  count: number;
}>> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      userId,
      type: "expense",
      occurredAt: { gte: monthStart },
    },
  });

  const byCategory: Record<string, { spent: number; count: number }> = {};
  for (const tx of transactions) {
    const cat = tx.category || "sem_categoria";
    if (!byCategory[cat]) byCategory[cat] = { spent: 0, count: 0 };
    byCategory[cat]!.spent += Math.abs(tx.amount);
    byCategory[cat]!.count++;
  }

  return Object.entries(byCategory)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.spent - a.spent);
}

/** Verifica limites de categoria e retorna alertas */
export async function checkBudgetLimits(userId: string): Promise<Array<{
  category: string;
  spent: number;
  limit: number;
  percentUsed: number;
  alert: "warning" | "critical" | "ok";
}>> {
  // Buscar limites definidos pelo usuário (salvos como preferences)
  const limitPrefs = await prisma.userPreference.findMany({
    where: { userId, key: { startsWith: "budget_limit_" } },
  });

  const limits: Record<string, number> = {};
  for (const pref of limitPrefs) {
    const cat = pref.key.replace("budget_limit_", "");
    limits[cat] = parseFloat(pref.value) || 0;
  }

  if (Object.keys(limits).length === 0) return [];

  const spending = await getMonthlyCategorySpend(userId);
  const results: Array<{ category: string; spent: number; limit: number; percentUsed: number; alert: "warning" | "critical" | "ok" }> = [];

  for (const [category, limit] of Object.entries(limits)) {
    const catSpend = spending.find((s) => s.category === category);
    const spent = catSpend?.spent ?? 0;
    const percentUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    results.push({
      category,
      spent,
      limit,
      percentUsed,
      alert: percentUsed >= 90 ? "critical" : percentUsed >= 75 ? "warning" : "ok",
    });
  }

  return results.sort((a, b) => b.percentUsed - a.percentUsed);
}

/** Calcula burn rate e projeção de fim de mês */
export async function calculateBurnRate(userId: string): Promise<{
  totalSpentThisMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyAverage: number;
  projectedMonthTotal: number;
  trend: "under" | "on_track" | "over";
}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysElapsed = Math.max(1, now.getDate());
  const daysRemaining = monthEnd.getDate() - now.getDate();
  const totalDays = monthEnd.getDate();

  const transactions = await prisma.financeTransaction.findMany({
    where: { userId, type: "expense", occurredAt: { gte: monthStart } },
  });

  const totalSpent = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const dailyAvg = totalSpent / daysElapsed;
  const projected = dailyAvg * totalDays;

  // Compare with last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthTx = await prisma.financeTransaction.findMany({
    where: { userId, type: "expense", occurredAt: { gte: lastMonthStart, lte: lastMonthEnd } },
  });
  const lastMonthTotal = lastMonthTx.reduce((s, t) => s + Math.abs(t.amount), 0);

  const trend = projected > lastMonthTotal * 1.15 ? "over"
    : projected < lastMonthTotal * 0.85 ? "under"
    : "on_track";

  return {
    totalSpentThisMonth: Math.round(totalSpent * 100) / 100,
    daysElapsed,
    daysRemaining,
    dailyAverage: Math.round(dailyAvg * 100) / 100,
    projectedMonthTotal: Math.round(projected * 100) / 100,
    trend,
  };
}

/** Detecta assinaturas potencialmente não usadas */
export async function detectUnusedSubscriptions(userId: string): Promise<Array<{
  name: string;
  amount: number;
  lastUsedHint: string;
}>> {
  const subs = await prisma.financeSubscription.findMany({
    where: { userId, active: true },
  });

  // Check if there's a corresponding media item or recent mention
  const results: Array<{ name: string; amount: number; lastUsedHint: string }> = [];

  for (const sub of subs) {
    // Check if subscription service was mentioned in recent conversations
    const recentMention = await prisma.memory.findFirst({
      where: {
        userId,
        content: { contains: sub.name.split(" ")[0] ?? sub.name },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
    }).catch(() => null);

    if (!recentMention) {
      results.push({
        name: sub.name,
        amount: sub.amount,
        lastUsedHint: "Sem mencao nos ultimos 30 dias — possivel candidato a cancelamento.",
      });
    }
  }

  return results;
}
