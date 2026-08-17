import { env } from "../config/env.js";

interface SlackMessage {
  user?: string;
  username?: string;
  text?: string;
  ts?: string;
}

interface SlackApiResponse<T> {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  channel?: string;
  ts?: string;
  data?: T;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks?: {
    items: Array<{
      name: string;
      external_urls?: { spotify?: string };
      artists: Array<{ name: string }>;
      album?: { name: string };
      popularity?: number;
    }>;
  };
  playlists?: {
    items: Array<{
      name: string;
      description?: string | null;
      external_urls?: { spotify?: string };
      owner?: { display_name?: string };
      tracks?: { total?: number };
    } | null>;
  };
}

interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  due?: { string?: string; date?: string } | null;
  priority: number;
  url: string;
}

interface LinearGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state?: { name: string } | null;
  assignee?: { name: string } | null;
}

interface LinearTeamNode {
  id: string;
  key: string;
  name: string;
}

function limit(input: string, max = 200): string {
  const clean = input.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trim()}...`;
}

async function parseJson<T>(res: Response, provider: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; error_description?: string };
  if (!res.ok) {
    const reason = body.error_description ?? body.error ?? `HTTP ${res.status}`;
    throw new Error(`${provider}: ${reason}`);
  }
  return body;
}

export async function slackHistory(input: { channelId: string; limit?: number }): Promise<string> {
  if (!env.SLACK_BOT_TOKEN) throw new Error("Slack nao configurado: SLACK_BOT_TOKEN ausente.");
  const url = new URL("https://slack.com/api/conversations.history");
  url.searchParams.set("channel", input.channelId);
  url.searchParams.set("limit", String(Math.min(Math.max(input.limit ?? 10, 1), 25)));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
  });
  const body = await parseJson<SlackApiResponse<unknown>>(res, "Slack");
  if (!body.ok) throw new Error(`Slack: ${body.error ?? "erro desconhecido"}`);
  const messages = body.messages ?? [];
  if (!messages.length) return "Nenhuma mensagem encontrada nesse canal.";
  return messages
    .map((msg, index) => `${index + 1}. ${msg.username ?? msg.user ?? "Slack"} [${msg.ts ?? "sem ts"}]\n   ${limit(msg.text ?? "", 500)}`)
    .join("\n\n");
}

export async function slackPostMessage(input: { channelId: string; text: string }): Promise<string> {
  if (!env.SLACK_BOT_TOKEN) throw new Error("Slack nao configurado: SLACK_BOT_TOKEN ausente.");
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: input.channelId, text: input.text }),
  });
  const body = await parseJson<SlackApiResponse<unknown>>(res, "Slack");
  if (!body.ok) throw new Error(`Slack: ${body.error ?? "erro desconhecido"}`);
  return `Mensagem enviada no Slack em ${body.channel ?? input.channelId} (${body.ts ?? "sem ts"}).`;
}

let spotifyAppToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyAppToken(): Promise<string> {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify nao configurado: SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET ausentes.");
  }
  if (spotifyAppToken && spotifyAppToken.expiresAt > Date.now() + 30_000) return spotifyAppToken.token;
  const credentials = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const body = await parseJson<SpotifyTokenResponse>(res, "Spotify");
  spotifyAppToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export async function spotifySearch(input: { query: string; type?: "track" | "playlist"; limit?: number }): Promise<string> {
  const token = await getSpotifyAppToken();
  const type = input.type ?? "playlist";
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", input.query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(Math.min(Math.max(input.limit ?? 8, 1), 10)));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await parseJson<SpotifySearchResponse>(res, "Spotify");
  if (type === "track") {
    const tracks = body.tracks?.items ?? [];
    if (!tracks.length) return `Nenhuma faixa encontrada para "${input.query}".`;
    return tracks
      .map((track, index) => `${index + 1}. ${track.name} - ${track.artists.map((a) => a.name).join(", ")}\n   Album: ${track.album?.name ?? "n/a"} | Popularidade: ${track.popularity ?? 0}\n   ${track.external_urls?.spotify ?? ""}`)
      .join("\n\n");
  }
  const playlists = (body.playlists?.items ?? []).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!playlists.length) return `Nenhuma playlist encontrada para "${input.query}".`;
  return playlists
    .map((playlist, index) => `${index + 1}. ${playlist.name} (${playlist.tracks?.total ?? 0} faixas)\n   Por: ${playlist.owner?.display_name ?? "Spotify"}\n   ${limit(playlist.description ?? "Sem descricao.", 260)}\n   ${playlist.external_urls?.spotify ?? ""}`)
    .join("\n\n");
}

export async function todoistListTasks(input: { filter?: string; limit?: number }): Promise<string> {
  if (!env.TODOIST_API_TOKEN) throw new Error("Todoist nao configurado: TODOIST_API_TOKEN ausente.");
  const url = new URL("https://api.todoist.com/rest/v2/tasks");
  if (input.filter) url.searchParams.set("filter", input.filter);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.TODOIST_API_TOKEN}` } });
  const tasks = await parseJson<TodoistTask[]>(res, "Todoist");
  const sliced = tasks.slice(0, Math.min(Math.max(input.limit ?? 12, 1), 30));
  if (!sliced.length) return "Nenhuma tarefa aberta no Todoist para esse filtro.";
  return sliced
    .map((task, index) => `${index + 1}. ${task.content}\n   Prioridade: ${task.priority} | Prazo: ${task.due?.string ?? task.due?.date ?? "sem prazo"}\n   ${task.url}`)
    .join("\n\n");
}

export async function todoistCreateTask(input: { content: string; description?: string; dueString?: string; priority?: number }): Promise<string> {
  if (!env.TODOIST_API_TOKEN) throw new Error("Todoist nao configurado: TODOIST_API_TOKEN ausente.");
  const res = await fetch("https://api.todoist.com/rest/v2/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TODOIST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.content,
      description: input.description,
      due_string: input.dueString,
      priority: input.priority,
    }),
  });
  const task = await parseJson<TodoistTask>(res, "Todoist");
  return `Tarefa criada no Todoist: ${task.content}\n${task.url}`;
}

async function linearGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = env.LINEAR_OAUTH_TOKEN || env.LINEAR_API_KEY;
  if (!token) throw new Error("Linear nao configurado: LINEAR_API_KEY ou LINEAR_OAUTH_TOKEN ausente.");
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: env.LINEAR_OAUTH_TOKEN ? `Bearer ${token}` : token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await parseJson<LinearGraphqlResponse<T>>(res, "Linear");
  if (body.errors?.length) throw new Error(`Linear: ${body.errors.map((e) => e.message).join("; ")}`);
  if (!body.data) throw new Error("Linear: resposta sem data.");
  return body.data;
}

export async function linearListTeams(): Promise<string> {
  const data = await linearGraphql<{ teams: { nodes: LinearTeamNode[] } }>(`
    query OrionTeams {
      teams(first: 20) {
        nodes { id key name }
      }
    }
  `);
  if (!data.teams.nodes.length) return "Nenhum time encontrado no Linear.";
  return data.teams.nodes.map((team, index) => `${index + 1}. ${team.name} (${team.key})\n   teamId: ${team.id}`).join("\n\n");
}

export async function linearListIssues(input: { query?: string; limit?: number }): Promise<string> {
  const data = await linearGraphql<{ issues: { nodes: LinearIssueNode[] } }>(
    `
    query OrionIssues($first: Int!) {
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          url
          state { name }
          assignee { name }
        }
      }
    }
  `,
    { first: Math.min(Math.max(input.limit ?? 10, 1), 25) },
  );
  const needle = input.query?.toLowerCase().trim();
  const issues = needle
    ? data.issues.nodes.filter((issue) => `${issue.identifier} ${issue.title}`.toLowerCase().includes(needle))
    : data.issues.nodes;
  if (!issues.length) return "Nenhuma issue encontrada no Linear.";
  return issues
    .map((issue, index) => `${index + 1}. ${issue.identifier} - ${issue.title}\n   Estado: ${issue.state?.name ?? "n/a"} | Responsavel: ${issue.assignee?.name ?? "sem responsavel"}\n   ${issue.url}`)
    .join("\n\n");
}

export async function linearCreateIssue(input: { teamId: string; title: string; description?: string }): Promise<string> {
  const data = await linearGraphql<{ issueCreate: { success: boolean; issue?: LinearIssueNode | null } }>(
    `
    mutation OrionCreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `,
    {
      input: {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
      },
    },
  );
  if (!data.issueCreate.success || !data.issueCreate.issue) throw new Error("Linear: issueCreate nao confirmou sucesso.");
  const issue = data.issueCreate.issue;
  return `Issue criada no Linear: ${issue.identifier} - ${issue.title}\n${issue.url}`;
}
