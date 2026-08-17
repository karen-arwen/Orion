import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function hasWorkspacePackageJson(dir: string): boolean {
  const packageJson = path.join(dir, "package.json");
  if (!existsSync(packageJson)) return false;
  try {
    const parsed = JSON.parse(readFileSync(packageJson, "utf-8")) as { workspaces?: unknown };
    return Array.isArray(parsed.workspaces) || typeof parsed.workspaces === "object";
  } catch {
    return false;
  }
}

export function findWorkspaceRoot(start = process.cwd()): string {
  let current = path.resolve(start);
  while (true) {
    if (hasWorkspacePackageJson(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

export const WORKSPACE_ROOT = findWorkspaceRoot();

export function normalizeWorkspaceRelativePath(inputPath: string): string {
  const cleaned = inputPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);
  const rootWithSep = WORKSPACE_ROOT.endsWith(path.sep) ? WORKSPACE_ROOT : `${WORKSPACE_ROOT}${path.sep}`;
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(rootWithSep)) {
    throw new Error("PATH_OUTSIDE_WORKSPACE");
  }
  return path.relative(WORKSPACE_ROOT, resolved).replace(/\\/g, "/");
}

export function resolveWorkspacePath(inputPath: string): string {
  return path.join(WORKSPACE_ROOT, normalizeWorkspaceRelativePath(inputPath));
}
