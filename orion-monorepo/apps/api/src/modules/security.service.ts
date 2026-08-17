import type {
  SecurityAccount,
  SecurityAccountInput,
  SecurityFinding,
  SecurityFindingInput,
  SecurityPosture,
} from "@orion/types";
import { prisma } from "../db/prisma.js";

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toAccount(row: {
  id: string;
  service: string;
  category: string;
  email: string;
  hasTwoFactor: boolean;
  usesPasswordManager: boolean;
  passwordRotatedAt: Date | null;
  recoveryCheckedAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}): SecurityAccount {
  return {
    ...row,
    passwordRotatedAt: row.passwordRotatedAt?.toISOString() ?? null,
    recoveryCheckedAt: row.recoveryCheckedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFinding(row: {
  id: string;
  title: string;
  detail: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  resolved: boolean;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): SecurityFinding {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSecurityPosture(userId: string): Promise<SecurityPosture> {
  const [accounts, findings] = await Promise.all([
    prisma.securityAccount.findMany({
      where: { userId },
      orderBy: [{ category: "asc" }, { service: "asc" }],
      take: 80,
    }),
    prisma.securityFinding.findMany({
      where: { userId },
      orderBy: [{ resolved: "asc" }, { risk: "desc" }, { updatedAt: "desc" }],
      take: 50,
    }),
  ]);

  const total = accounts.length;
  const twoFactorCoverage = total ? Math.round((accounts.filter((a) => a.hasTwoFactor).length / total) * 100) : 0;
  const passwordManagerCoverage = total ? Math.round((accounts.filter((a) => a.usesPasswordManager).length / total) * 100) : 0;
  const open = findings.filter((f) => !f.resolved);
  const criticalFindings = open.filter((f) => f.risk === "critical" || f.risk === "high").length;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(twoFactorCoverage * 0.4 + passwordManagerCoverage * 0.35 + (open.length === 0 ? 25 : Math.max(0, 25 - open.length * 5))),
    ),
  );

  const checklist = [
    {
      id: "2fa-core",
      label: "2FA nas contas criticas",
      done: total > 0 && twoFactorCoverage >= 80,
      detail: `${twoFactorCoverage}% das contas registradas com 2FA.`,
    },
    {
      id: "password-manager",
      label: "Gerenciador de senhas",
      done: total > 0 && passwordManagerCoverage >= 80,
      detail: `${passwordManagerCoverage}% das contas no gerenciador.`,
    },
    {
      id: "findings",
      label: "Achados criticos resolvidos",
      done: criticalFindings === 0,
      detail: criticalFindings ? `${criticalFindings} achado(s) de alto risco aberto(s).` : "Nenhum achado alto aberto.",
    },
    {
      id: "recovery",
      label: "Recuperacao revisada",
      done: accounts.some((a) => a.recoveryCheckedAt),
      detail: "Verifique emails/telefones de recuperacao nas contas principais.",
    },
  ];

  const plan = [
    ...(twoFactorCoverage < 80
      ? [{
          title: "Ativar 2FA nas contas principais",
          detail: "Priorize email, banco, GitHub, cloud, redes sociais e gerenciador de senha.",
          risk: "high" as const,
        }]
      : []),
    ...(passwordManagerCoverage < 80
      ? [{
          title: "Migrar senhas para gerenciador",
          detail: "Senhas unicas reduzem dano em vazamento de uma conta isolada.",
          risk: "medium" as const,
        }]
      : []),
    ...(criticalFindings > 0
      ? [{
          title: "Fechar achados criticos",
          detail: "Resolva primeiro qualquer vazamento, senha reutilizada ou 2FA ausente em conta sensivel.",
          risk: "critical" as const,
        }]
      : []),
    {
      title: "Registrar contas sensiveis restantes",
      detail: "Quanto mais inventario, mais preciso o Guard fica para priorizar risco.",
      risk: "low" as const,
    },
  ];

  return {
    score,
    signal: score >= 80 ? "hardened" : score >= 50 ? "attention" : "exposed",
    accountsTotal: total,
    twoFactorCoverage,
    passwordManagerCoverage,
    openFindings: open.length,
    criticalFindings,
    accounts: accounts.map(toAccount),
    findings: findings.map(toFinding),
    checklist,
    plan,
  };
}

export async function createSecurityAccount(userId: string, input: SecurityAccountInput): Promise<SecurityAccount> {
  const row = await prisma.securityAccount.create({
    data: {
      userId,
      service: input.service,
      category: input.category ?? "geral",
      email: input.email ?? "",
      hasTwoFactor: input.hasTwoFactor ?? false,
      usesPasswordManager: input.usesPasswordManager ?? false,
      passwordRotatedAt: parseDate(input.passwordRotatedAt),
      recoveryCheckedAt: parseDate(input.recoveryCheckedAt),
      notes: input.notes ?? "",
    },
  });
  return toAccount(row);
}

export async function updateSecurityAccount(userId: string, id: string, input: Partial<SecurityAccountInput>): Promise<SecurityAccount> {
  const owned = await prisma.securityAccount.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("SECURITY_ACCOUNT_NOT_FOUND");
  const row = await prisma.securityAccount.update({
    where: { id },
    data: {
      ...(input.service !== undefined ? { service: input.service } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.hasTwoFactor !== undefined ? { hasTwoFactor: input.hasTwoFactor } : {}),
      ...(input.usesPasswordManager !== undefined ? { usesPasswordManager: input.usesPasswordManager } : {}),
      ...(input.passwordRotatedAt !== undefined ? { passwordRotatedAt: parseDate(input.passwordRotatedAt) } : {}),
      ...(input.recoveryCheckedAt !== undefined ? { recoveryCheckedAt: parseDate(input.recoveryCheckedAt) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  return toAccount(row);
}

export async function createSecurityFinding(userId: string, input: SecurityFindingInput): Promise<SecurityFinding> {
  const row = await prisma.securityFinding.create({
    data: {
      userId,
      title: input.title,
      detail: input.detail,
      action: input.action,
      risk: input.risk ?? "medium",
      source: input.source ?? "manual",
    },
  });
  return toFinding(row);
}

export async function resolveSecurityFinding(userId: string, id: string): Promise<SecurityFinding> {
  const owned = await prisma.securityFinding.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("SECURITY_FINDING_NOT_FOUND");
  const row = await prisma.securityFinding.update({ where: { id }, data: { resolved: true } });
  return toFinding(row);
}
