import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ExternalActionType } from "@orion/types";
import { linearCreateIssue, slackPostMessage, todoistCreateTask } from "../integrations/external-connectors.js";
import { resolveWorkspacePath } from "../modules/workspace-root.js";
import { applySearchReplaceOperations } from "../modules/workspace-edit.js";

export interface ExternalExecutionResult {
  type: ExternalActionType;
  label: string;
  entityId: string | null;
  summary: string;
}

const externalActionSchema = z.object({
  type: z.enum([
    "slack.post_message",
    "todoist.create_task",
    "linear.create_issue",
    "workspace.write_file",
    "workspace.patch_file",
    "workspace.run_command",
  ]),
  input: z.record(z.unknown()),
  preview: z.object({
    provider: z.string().min(1),
    title: z.string().min(1),
    destination: z.string().optional(),
    body: z.string().optional(),
    risk: z.enum(["low", "medium", "high"]).default("medium"),
  }).optional(),
});

const slackPostSchema = z.object({
  channelId: z.string().min(1),
  text: z.string().min(1).max(4000),
});

const todoistCreateSchema = z.object({
  content: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  dueString: z.string().max(120).optional(),
  priority: z.number().int().min(1).max(4).optional(),
});

const linearCreateSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().max(10_000).optional(),
});

const workspaceWriteSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(200_000),
  mode: z.enum(["create", "replace"]).default("replace"),
});

const workspacePatchSchema = z.object({
  path: z.string().min(1).max(500),
  operations: z.array(z.object({
    search: z.string().min(1).max(80_000),
    replace: z.string().max(80_000),
    replaceAll: z.boolean().optional(),
  })).min(1).max(10),
});

const workspaceCommandSchema = z.object({
  command: z.enum(["npm", "git"]),
  args: z.array(z.string().min(1).max(160)).min(1).max(12),
  cwd: z.string().min(1).max(500).default("."),
});

export function hasExternalAction(payload: Record<string, unknown>): boolean {
  return externalActionSchema.safeParse(payload.externalAction).success;
}

export async function executeExternalAction(payload: Record<string, unknown>): Promise<ExternalExecutionResult | null> {
  const parsed = externalActionSchema.safeParse(payload.externalAction);
  if (!parsed.success) return null;
  const action = parsed.data;

  switch (action.type) {
    case "slack.post_message": {
      const input = slackPostSchema.parse(action.input);
      const result = await slackPostMessage(input);
      return {
        type: action.type,
        label: "Mensagem enviada no Slack",
        entityId: input.channelId,
        summary: result,
      };
    }
    case "todoist.create_task": {
      const input = todoistCreateSchema.parse(action.input);
      const result = await todoistCreateTask(input);
      return {
        type: action.type,
        label: "Tarefa criada no Todoist",
        entityId: null,
        summary: result,
      };
    }
    case "linear.create_issue": {
      const input = linearCreateSchema.parse(action.input);
      const result = await linearCreateIssue(input);
      return {
        type: action.type,
        label: "Issue criada no Linear",
        entityId: input.teamId,
        summary: result,
      };
    }
    case "workspace.write_file": {
      const input = workspaceWriteSchema.parse(action.input);
      const filePath = resolveWorkspacePath(input.path);
      if (input.mode === "create") {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content, { encoding: "utf-8", flag: "wx" });
      } else {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content, "utf-8");
      }
      return {
        type: action.type,
        label: input.mode === "create" ? "Arquivo criado" : "Arquivo atualizado",
        entityId: input.path,
        summary: `${input.mode === "create" ? "Criei" : "Atualizei"} ${input.path}.`,
      };
    }
    case "workspace.patch_file": {
      const input = workspacePatchSchema.parse(action.input);
      const filePath = resolveWorkspacePath(input.path);
      const original = await fs.readFile(filePath, "utf-8");
      const result = applySearchReplaceOperations(original, input.operations);
      await fs.writeFile(filePath, result.content, "utf-8");
      return {
        type: action.type,
        label: "Patch aplicado",
        entityId: input.path,
        summary: `Apliquei ${result.replacements} substituicao(oes) em ${input.path}.`,
      };
    }
    case "workspace.run_command": {
      const input = workspaceCommandSchema.parse(action.input);
      validateWorkspaceCommand(input.command, input.args);
      const cwd = resolveWorkspacePath(input.cwd);
      const result = await runWorkspaceCommand(input.command, input.args, cwd);
      return {
        type: action.type,
        label: result.exitCode === 0 ? "Comando executado" : "Comando falhou",
        entityId: input.cwd,
        summary: `Exit ${result.exitCode}: ${result.output.slice(0, 3500)}`,
      };
    }
  }
}

function validateWorkspaceCommand(command: "npm" | "git", args: string[]): void {
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

function runWorkspaceCommand(command: "npm" | "git", args: string[], cwd: string): Promise<{ exitCode: number; output: string }> {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      output += "\n[TIMEOUT] comando interrompido apos 60s.";
    }, 60_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8");
      output = output.slice(-12_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8");
      output = output.slice(-12_000);
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ exitCode: 1, output: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? 1, output: output.trim() || "(sem saida)" });
    });
  });
}
