import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   GitHub Handlers — acesso à API do GitHub via token OAuth do usuário.

   Usa o token salvo na tabela Integration (provider="github").
   Todas as operações de leitura são seguras. Escritas (criar issue,
   comentar, fechar PR) passam pela Decision Inbox.

   API base: https://api.github.com
   Docs: https://docs.github.com/en/rest
═══════════════════════════════════════════════════════════════════ */

const GH_API = "https://api.github.com";

async function githubToken(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findFirst({
    where: { userId, provider: "github" as any, status: "connected" },
    select: { accessToken: true },
  });
  return integration?.accessToken ?? null;
}

async function ghFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Tipos ────────────────────────────────────────────────────────

interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  stargazers_count: number;
  updated_at: string;
  open_issues_count: number;
  default_branch: string;
  language: string | null;
}

interface GHIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string };
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
  comments: number;
  body: string | null;
  pull_request?: object;  // presente se for PR
}

interface GHPullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string };
  base: { ref: string };
  head: { ref: string };
  draft: boolean;
  created_at: string;
  updated_at: string;
  mergeable_state: string | null;
  requested_reviewers: Array<{ login: string }>;
  body: string | null;
}

interface GHWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  head_commit: { message: string };
}

// ─── Handlers ─────────────────────────────────────────────────────

/** Lista repositórios do usuário autenticado (mais recentes primeiro) */
export async function githubListRepos(userId: string): Promise<{
  repos: Array<Pick<GHRepo, "full_name" | "name" | "description" | "html_url" | "private" | "stargazers_count" | "open_issues_count" | "language" | "updated_at">>;
}> {
  const token = await githubToken(userId);
  if (!token) return { repos: [] };

  const data = await ghFetch(token, "/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator") as GHRepo[];
  return {
    repos: data.map((r) => ({
      full_name: r.full_name,
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      private: r.private,
      stargazers_count: r.stargazers_count,
      open_issues_count: r.open_issues_count,
      language: r.language,
      updated_at: r.updated_at,
    })),
  };
}

/** Lista issues abertas de um repositório */
export async function githubListIssues(userId: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<{
  issues: Array<Pick<GHIssue, "number" | "title" | "state" | "html_url" | "labels" | "created_at" | "updated_at" | "comments">>;
}> {
  const token = await githubToken(userId);
  if (!token) return { issues: [] };

  const data = await ghFetch(token, `/repos/${repo}/issues?state=${state}&per_page=20&pulls=false`) as GHIssue[];
  // Filtra PRs (issues com pull_request field)
  const issues = data.filter((i) => !i.pull_request);

  return {
    issues: issues.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      html_url: i.html_url,
      labels: i.labels,
      created_at: i.created_at,
      updated_at: i.updated_at,
      comments: i.comments,
    })),
  };
}

/** Lista pull requests abertos */
export async function githubListPRs(userId: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<{
  prs: Array<Pick<GHPullRequest, "number" | "title" | "state" | "html_url" | "user" | "base" | "head" | "draft" | "created_at" | "updated_at" | "requested_reviewers">>;
}> {
  const token = await githubToken(userId);
  if (!token) return { prs: [] };

  const data = await ghFetch(token, `/repos/${repo}/pulls?state=${state}&per_page=20`) as GHPullRequest[];

  return {
    prs: data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      html_url: pr.html_url,
      user: pr.user,
      base: pr.base,
      head: pr.head,
      draft: pr.draft,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      requested_reviewers: pr.requested_reviewers,
    })),
  };
}

/** Lê detalhes de uma issue específica */
export async function githubGetIssue(userId: string, repo: string, issueNumber: number): Promise<GHIssue | null> {
  const token = await githubToken(userId);
  if (!token) return null;

  return await ghFetch(token, `/repos/${repo}/issues/${issueNumber}`) as GHIssue;
}

/** Lista últimas Actions/CI runs de um repo */
export async function githubListWorkflowRuns(userId: string, repo: string): Promise<{
  runs: Array<Pick<GHWorkflowRun, "id" | "name" | "status" | "conclusion" | "html_url" | "created_at" | "head_commit">>;
}> {
  const token = await githubToken(userId);
  if (!token) return { runs: [] };

  const data = await ghFetch(token, `/repos/${repo}/actions/runs?per_page=10`) as { workflow_runs: GHWorkflowRun[] };

  return {
    runs: (data.workflow_runs ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      html_url: r.html_url,
      created_at: r.created_at,
      head_commit: r.head_commit,
    })),
  };
}

/** Cria uma issue (requer aprovação via Decision Inbox) */
export async function githubCreateIssue(
  userId: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[],
): Promise<{ number: number; html_url: string }> {
  const token = await githubToken(userId);
  if (!token) throw new Error("GitHub não conectado");

  const data = await ghFetch(token, `/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body, labels: labels ?? [] }),
  }) as { number: number; html_url: string };

  return { number: data.number, html_url: data.html_url };
}

/** Résumé rápido de um repositório: issues abertas + PRs + último build */
export async function githubRepoSummary(userId: string, repo: string): Promise<{
  repo: string;
  openIssues: number;
  openPRs: number;
  lastBuild: string | null;
  lastBuildStatus: string | null;
  url: string;
}> {
  const token = await githubToken(userId);
  if (!token) throw new Error("GitHub não conectado");

  const [repoData, issues, prs, runs] = await Promise.all([
    ghFetch(token, `/repos/${repo}`) as Promise<GHRepo>,
    githubListIssues(userId, repo),
    githubListPRs(userId, repo),
    githubListWorkflowRuns(userId, repo),
  ]);

  const lastRun = runs.runs[0];

  return {
    repo,
    openIssues: issues.issues.length,
    openPRs: prs.prs.length,
    lastBuild: lastRun?.created_at ?? null,
    lastBuildStatus: lastRun?.conclusion ?? lastRun?.status ?? null,
    url: (repoData as GHRepo).html_url,
  };
}

/** Lista notificações não lidas do GitHub */
export async function githubListNotifications(userId: string): Promise<Array<{
  id: string;
  type: string;
  title: string;
  repo: string;
  reason: string;
  url: string;
  updatedAt: string;
}>> {
  const token = await githubToken(userId);
  if (!token) return [];

  const data = await ghFetch(token, "/notifications?all=false&per_page=20") as Array<{
    id: string;
    reason: string;
    updated_at: string;
    subject: { title: string; type: string; url: string };
    repository: { full_name: string };
  }>;

  return data.map((n) => ({
    id: n.id,
    type: n.subject.type,
    title: n.subject.title,
    repo: n.repository.full_name,
    reason: n.reason,
    url: n.subject.url,
    updatedAt: n.updated_at,
  }));
}
