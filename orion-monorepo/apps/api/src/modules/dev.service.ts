import { promises as fs } from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import type {
  DevCommandProposal,
  DevCommandProposalInput,
  DevCodeContextMap,
  DevContextEntry,
  DevDebugRunbook,
  DevExecutionDiagnosis,
  DevFilePreview,
  DevPatchProposal,
  DevPatchProposalInput,
  DevWorkspaceSummary,
} from "@orion/types";
import { createDecision, listDecisions } from "../decisions/decision.service.js";
import { WORKSPACE_ROOT as ROOT, normalizeWorkspaceRelativePath } from "./workspace-root.js";
import { applySearchReplaceOperations, buildUnifiedPreview } from "./workspace-edit.js";

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage"]);
const MAX_FILES = 420;
const MAX_READ = 40_000;

function normalizeRelativePath(input: string): string {
  return normalizeWorkspaceRelativePath(input);
}

async function walk(dir: string, acc: DevWorkspaceSummary["files"]): Promise<void> {
  if (acc.length >= MAX_FILES) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (acc.length >= MAX_FILES) return;
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) await walk(full, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(full);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    acc.push({ path: rel, ext: path.extname(entry.name).toLowerCase() || "(none)", size: stat.size });
  }
}

export async function getWorkspaceSummary(): Promise<DevWorkspaceSummary> {
  const files: DevWorkspaceSummary["files"] = [];
  await walk(ROOT, files);
  const byExt = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.ext] = (acc[file.ext] ?? 0) + 1;
    return acc;
  }, {});
  return {
    root: ROOT,
    files: files.sort((a, b) => a.path.localeCompare(b.path)).slice(0, MAX_FILES),
    counts: { total: files.length, byExt },
  };
}

export async function getCodeContextMap(): Promise<DevCodeContextMap> {
  const workspace = await getWorkspaceSummary();
  const files = workspace.files;
  const routes = files.filter((file) => /^apps\/api\/src\/routes\/.*\.routes\.ts$/.test(file.path));
  const services = files.filter((file) => /^apps\/api\/src\/modules\/.*\.service\.ts$/.test(file.path));
  const ai = files.filter((file) => /^apps\/api\/src\/ai\/.*\.ts$/.test(file.path));
  const integrations = files.filter((file) => /^apps\/api\/src\/integrations\/.*\.ts$/.test(file.path));
  const pages = files.filter((file) => /^apps\/web\/src\/pages\/.*\.tsx$/.test(file.path));
  const modulePages = files.filter((file) => /^apps\/web\/src\/pages\/modules\/.*\.tsx$/.test(file.path));
  const hooks = files.filter((file) => /^apps\/web\/src\/hooks\/.*\.(ts|tsx)$/.test(file.path));
  const components = files.filter((file) => /^apps\/web\/src\/components\/.*\.tsx$/.test(file.path));
  const stores = files.filter((file) => /^apps\/web\/src\/stores\/.*\.ts$/.test(file.path));
  const types = files.filter((file) => /^packages\/types\/src\/.*\.ts$/.test(file.path));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      files: files.length,
      apiRoutes: routes.length,
      apiServices: services.length,
      webPages: pages.length,
      webHooks: hooks.length,
      sharedTypes: types.length,
    },
    api: {
      routes: routes.map((file) => toContextEntry(file.path, "api-route", "api")),
      services: services.map((file) => toContextEntry(file.path, "api-service", "api")),
      ai: ai.map((file) => toContextEntry(file.path, "ai-core", "api")),
      integrations: integrations.map((file) => toContextEntry(file.path, "integration", "api")),
    },
    web: {
      pages: pages.filter((file) => !modulePages.some((item) => item.path === file.path)).map((file) => toContextEntry(file.path, "web-page", "web")),
      modulePages: modulePages.map((file) => toContextEntry(file.path, "module-page", "web")),
      hooks: hooks.map((file) => toContextEntry(file.path, "hook", "web")),
      components: components.map((file) => toContextEntry(file.path, "component", "web")),
      stores: stores.map((file) => toContextEntry(file.path, "store", "web")),
    },
    shared: {
      types: types.map((file) => toContextEntry(file.path, "shared-type", "types")),
    },
    recommendations: [
      "Para modulo novo, crie tipos em packages/types, service+route em apps/api e hook+page em apps/web.",
      "Para bug de chat/IA, comece por apps/api/src/ai/ai.service.ts, tools.ts e system-prompt.ts.",
      "Para UX de modulo, comece pela page em apps/web/src/pages/modules e seu hook em apps/web/src/hooks/modules.",
      "Para acao aprovada/autonomia, comece em apps/api/src/decisions e no NotificationCenter do web.",
    ],
  };
}

function toContextEntry(pathValue: string, kind: string, area: string): DevContextEntry {
  const base = path.basename(pathValue).replace(/\.(routes|service)\.(ts|tsx)$/, "").replace(/\.(ts|tsx)$/, "");
  return {
    path: pathValue,
    name: base,
    kind,
    area,
  };
}

export async function readWorkspaceFile(inputPath: string): Promise<DevFilePreview> {
  const rel = normalizeRelativePath(inputPath);
  const full = path.join(ROOT, rel);
  const stat = await fs.stat(full);
  if (!stat.isFile()) throw new Error("NOT_FILE");
  const raw = await fs.readFile(full, "utf-8");
  return {
    path: rel,
    content: raw.slice(0, MAX_READ),
    truncated: raw.length > MAX_READ,
  };
}

export async function prepareWorkspacePatch(userId: string, input: DevPatchProposalInput): Promise<DevPatchProposal> {
  const rel = normalizeRelativePath(input.path);
  const mode = input.mode ?? "replace";
  const full = path.join(ROOT, rel);
  const current = mode === "create" ? "" : await fs.readFile(full, "utf-8").catch(() => "");
  const next =
    mode === "patch"
      ? applySearchReplaceOperations(current, input.operations ?? []).content
      : input.content ?? "";
  const preview =
    mode === "create"
      ? next.slice(0, 3000)
      : buildUnifiedPreview(rel, current, next).slice(0, 8000);

  const decision = await createDecision(userId, {
    source: "dev",
    title: input.title,
    summary: `${input.summary}${mode === "patch" ? " Patch search/replace validado contra o arquivo atual." : ""}`,
    proposedAction: `${mode === "create" ? "Criar" : mode === "patch" ? "Aplicar patch em" : "Substituir"} arquivo ${rel}`,
    priority: "high",
    dedupKey: `dev:${mode}:${rel}:${Date.now()}`,
    payload: {
      externalAction: {
        type: mode === "patch" ? "workspace.patch_file" : "workspace.write_file",
        input: mode === "patch"
          ? { path: rel, operations: input.operations ?? [] }
          : { path: rel, content: next, mode },
        preview: {
          provider: "workspace",
          title: input.title,
          destination: rel,
          body: preview,
          risk: "high",
        },
      },
    } as Prisma.JsonObject,
  });
  return { decisionId: decision.id, path: rel, mode, preview };
}

export async function prepareWorkspaceCommand(userId: string, input: DevCommandProposalInput): Promise<DevCommandProposal> {
  const cwd = input.cwd ? normalizeRelativePath(input.cwd) : ".";
  validateWorkspaceCommand(input.command, input.args);
  const commandLine = [input.command, ...input.args].map(quoteCommandPart).join(" ");
  const decision = await createDecision(userId, {
    source: "dev",
    title: input.title,
    summary: input.summary,
    proposedAction: `Executar comando verificado: ${commandLine}`,
    priority: "high",
    dedupKey: `dev:command:${commandLine}:${Date.now()}`,
    payload: {
      externalAction: {
        type: "workspace.run_command",
        input: {
          command: input.command,
          args: input.args,
          cwd,
        },
        preview: {
          provider: "workspace",
          title: input.title,
          destination: cwd,
          body: `$ ${commandLine}`,
          risk: "high",
        },
      },
    } as Prisma.JsonObject,
  });
  return { decisionId: decision.id, commandLine, cwd };
}

export function validateWorkspaceCommand(command: string, args: string[]): asserts command is "npm" | "git" {
  if (command !== "npm" && command !== "git") throw new Error("COMMAND_NOT_ALLOWED");
  if (args.some((arg) => /[;&|`$<>]/.test(arg))) throw new Error("COMMAND_ARG_BLOCKED");
  if (command === "npm") {
    if (args[0] !== "run") throw new Error("NPM_COMMAND_NOT_ALLOWED");
    if (!args[1] || args[1].startsWith("-")) throw new Error("NPM_SCRIPT_REQUIRED");
    return;
  }
  const gitSubcommand = args[0];
  if (!gitSubcommand || !["status", "diff", "log", "show", "branch"].includes(gitSubcommand)) {
    throw new Error("GIT_COMMAND_NOT_ALLOWED");
  }
}

function quoteCommandPart(part: string): string {
  return /\s/.test(part) ? `"${part.replace(/"/g, "\\\"")}"` : part;
}

export async function diagnoseWorkspaceExecution(userId: string): Promise<DevExecutionDiagnosis> {
  const [latest] = await listDecisions(userId, "executed");
  if (!latest) {
    return {
      hasExecution: false,
      decisionId: null,
      label: "Nenhuma execucao",
      exitCode: null,
      primaryError: null,
      files: [],
      suggestedNextSteps: ["Execute um comando de validacao pela Action Queue primeiro."],
      rawSummary: "",
    };
  }

  const execution =
    latest.payload.execution && typeof latest.payload.execution === "object" && !Array.isArray(latest.payload.execution)
      ? (latest.payload.execution as Record<string, unknown>)
      : null;
  const summary = typeof execution?.summary === "string" ? execution.summary : latest.proposedAction;
  const label = typeof execution?.label === "string" ? execution.label : latest.title;
  const exitCode = parseExitCode(summary);
  const files = parseDiagnosticFiles(summary);
  const primaryError = files[0]?.message ?? parseFirstErrorLine(summary);

  return {
    hasExecution: true,
    decisionId: latest.id,
    label,
    exitCode,
    primaryError,
    files,
    suggestedNextSteps: buildDiagnosisSteps(exitCode, files, summary),
    rawSummary: summary.slice(0, 8000),
  };
}

export async function buildDebugRunbook(userId: string): Promise<DevDebugRunbook> {
  const diagnosis = await diagnoseWorkspaceExecution(userId);
  if (!diagnosis.hasExecution) {
    return {
      title: "Sem execucao para diagnosticar",
      status: "idle",
      diagnosis,
      steps: [
        {
          id: "prepare-validation",
          label: "Preparar validacao",
          detail: "Rode um typecheck ou build pela Action Queue para gerar uma execucao auditavel.",
          kind: "validate",
          command: {
            title: "Executar typecheck API",
            summary: "Validacao inicial para alimentar o Auto Debug.",
            command: "npm",
            args: ["run", "typecheck", "--workspace", "apps/api"],
          },
        },
      ],
    };
  }

  const status: DevDebugRunbook["status"] = diagnosis.exitCode === 0 ? "pass" : "fail";
  const primaryFile = diagnosis.files[0];
  const steps: DevDebugRunbook["steps"] = [];

  if (status === "pass") {
    steps.push(
      {
        id: "review-git",
        label: "Revisar diff",
        detail: "A validacao passou. Revise o diff antes de continuar.",
        kind: "review",
        command: {
          title: "Executar git diff",
          summary: "Inspecionar alteracoes apos validacao bem-sucedida.",
          command: "git",
          args: ["diff", "--stat"],
        },
      },
      {
        id: "validate-web",
        label: "Validar frontend",
        detail: "Se a mudanca encostar em UI, rode build do web.",
        kind: "validate",
        command: {
          title: "Executar build web",
          summary: "Validar pacote web apos alteracoes.",
          command: "npm",
          args: ["run", "build", "--workspace", "apps/web"],
        },
      },
    );
    return { title: "Validacao passou", status, diagnosis, steps };
  }

  if (primaryFile) {
    steps.push({
      id: "inspect-primary-file",
      label: "Ler arquivo apontado",
      detail: `Abra ${primaryFile.path}${primaryFile.line ? ` perto da linha ${primaryFile.line}` : ""} e confirme o contexto antes de editar.`,
      kind: "inspect",
      target: primaryFile.path,
    });
    steps.push({
      id: "prepare-patch",
      label: "Preparar patch pequeno",
      detail: "Use search/replace com trecho exato. Evite reescrever o arquivo inteiro.",
      kind: "patch",
      target: primaryFile.path,
    });
  } else {
    steps.push({
      id: "inspect-summary",
      label: "Ler resumo bruto",
      detail: "A falha nao apontou arquivo unico. Use o resumo bruto para localizar o ponto de entrada.",
      kind: "inspect",
    });
  }

  steps.push({
    id: "rerun-validation",
    label: "Rodar validacao novamente",
    detail: "Depois do patch aprovado, rode novamente o comando de validacao mais provavel.",
    kind: "validate",
    command: inferValidationCommand(diagnosis.rawSummary),
  });

  return {
    title: diagnosis.primaryError ? `Debug: ${diagnosis.primaryError.slice(0, 80)}` : "Debug da ultima execucao",
    status,
    diagnosis,
    steps,
  };
}

function inferValidationCommand(summary: string): DevCommandProposalInput {
  if (/workspace apps\/web|vite build|@orion\/web|apps[\\/]web/i.test(summary)) {
    return {
      title: "Executar typecheck web",
      summary: "Revalidar frontend apos patch.",
      command: "npm",
      args: ["run", "typecheck", "--workspace", "apps/web"],
    };
  }
  if (/packages\/types|@orion\/types/i.test(summary)) {
    return {
      title: "Executar typecheck types",
      summary: "Revalidar pacote de tipos apos patch.",
      command: "npm",
      args: ["run", "typecheck", "--workspace", "packages/types"],
    };
  }
  return {
    title: "Executar typecheck API",
    summary: "Revalidar API apos patch.",
    command: "npm",
    args: ["run", "typecheck", "--workspace", "apps/api"],
  };
}

function parseExitCode(summary: string): number | null {
  const match = summary.match(/Exit\s+(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseDiagnosticFiles(summary: string): DevExecutionDiagnosis["files"] {
  const rows: DevExecutionDiagnosis["files"] = [];
  const patterns = [
    /([A-Za-z]:[\\/][^\r\n()]+?\.(?:ts|tsx|js|jsx))\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+([^\r\n]+)/g,
    /([^:\s][^\r\n:]+?\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\s+-?\s*error\s+(TS\d+)?:?\s*([^\r\n]+)/g,
    /Could not resolve ["']([^"']+)["']/g,
    /Cannot find module ["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of summary.matchAll(pattern)) {
      const pathCandidate = normalizeDiagnosticPath(match[1] ?? "");
      if (!pathCandidate) continue;
      rows.push({
        path: pathCandidate,
        line: match[2] ? Number(match[2]) : undefined,
        column: match[3] ? Number(match[3]) : undefined,
        code: match[4]?.startsWith("TS") ? match[4] : undefined,
        message: (match[5] ?? match[0]).trim(),
      });
      if (rows.length >= 8) return dedupeFiles(rows);
    }
  }
  return dedupeFiles(rows);
}

function normalizeDiagnosticPath(input: string): string | null {
  const clean = input.replace(/\\/g, "/").trim();
  if (!clean) return null;
  const marker = "/orion-monorepo/";
  const index = clean.toLowerCase().lastIndexOf(marker);
  if (index >= 0) return clean.slice(index + marker.length);
  return clean.replace(/^\.\/+/, "");
}

function dedupeFiles(files: DevExecutionDiagnosis["files"]): DevExecutionDiagnosis["files"] {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.path}:${file.line ?? ""}:${file.column ?? ""}:${file.code ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseFirstErrorLine(summary: string): string | null {
  const line = summary.split(/\r?\n/).find((row) => /error|failed|cannot|not found/i.test(row));
  return line?.trim() ?? null;
}

function buildDiagnosisSteps(
  exitCode: number | null,
  files: DevExecutionDiagnosis["files"],
  summary: string,
): string[] {
  if (exitCode === 0) {
    return ["Validacao passou. Proximo passo: revisar diff/git status ou seguir para outro modulo."];
  }
  const steps: string[] = [];
  if (files[0]) {
    steps.push(`Ler ${files[0].path}${files[0].line ? ` perto da linha ${files[0].line}` : ""}.`);
    steps.push("Preparar patch pequeno com search/replace no trecho exato.");
  }
  if (/TS2307|Cannot find module|Could not resolve/i.test(summary)) {
    steps.push("Verificar import/export e se o arquivo ou tipo existe no pacote correto.");
  }
  if (/TS2345|TS2322/i.test(summary)) {
    steps.push("Ajustar tipo de entrada/retorno sem usar any; preferir narrowing explicito.");
  }
  if (/eslint|lint/i.test(summary)) {
    steps.push("Corrigir regra de lint apontada antes de alterar comportamento.");
  }
  steps.push("Depois do patch, preparar novo comando de typecheck/build pela Action Queue.");
  return steps.slice(0, 5);
}
