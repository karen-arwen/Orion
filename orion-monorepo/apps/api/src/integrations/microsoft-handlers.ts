import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   Microsoft Graph Handlers — Outlook + Teams + OneDrive.

   Mirror funcional do google-handlers.ts mas para o ecossistema
   Microsoft. Usuários corporativos com Office 365 usam isso.

   API base: https://graph.microsoft.com/v1.0
   Docs: https://docs.microsoft.com/en-us/graph/overview

   Token: OAuth 2.0 via Microsoft Identity Platform (Azure AD).
   Renovação automática via refresh token (token-manager universal).
═══════════════════════════════════════════════════════════════════ */

const MS_API = "https://graph.microsoft.com/v1.0";

async function msToken(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findFirst({
    where: { userId, provider: "microsoft" as any, status: "connected" },
    select: { accessToken: true, expiresAt: true, refreshToken: true },
  });
  if (!integration) return null;

  // Se token expirou e há refresh, deveria ser renovado pelo token-manager
  // Aqui retornamos o que temos — token-manager cuida da renovação
  return integration.accessToken;
}

async function msFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${MS_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}

// ─── OUTLOOK EMAIL ─────────────────────────────────────────────────

interface MSEmail {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  importance: "low" | "normal" | "high";
  bodyPreview: string;
  hasAttachments: boolean;
  webLink: string;
}

/** Lista emails recentes do Outlook */
export async function outlookListEmails(userId: string, options?: {
  folder?: "inbox" | "sent" | "drafts";
  top?: number;
  unreadOnly?: boolean;
}): Promise<{ emails: MSEmail[] }> {
  const token = await msToken(userId);
  if (!token) return { emails: [] };

  const folder = options?.folder ?? "inbox";
  const top = options?.top ?? 20;
  const filter = options?.unreadOnly ? "&$filter=isRead eq false" : "";

  const data = await msFetch(
    token,
    `/me/mailFolders/${folder}/messages?$top=${top}&$orderby=receivedDateTime desc${filter}&$select=id,subject,from,receivedDateTime,isRead,importance,bodyPreview,hasAttachments,webLink`,
  ) as { value: MSEmail[] };

  return { emails: data.value ?? [] };
}

/** Lê corpo completo de um email */
export async function outlookGetEmail(userId: string, messageId: string): Promise<{
  subject: string;
  from: string;
  body: string;
  receivedAt: string;
} | null> {
  const token = await msToken(userId);
  if (!token) return null;

  const data = await msFetch(token, `/me/messages/${messageId}?$select=subject,from,body,receivedDateTime`) as {
    subject: string;
    from: { emailAddress: { name: string; address: string } };
    body: { content: string; contentType: string };
    receivedDateTime: string;
  };

  // Strip HTML se contentType for html
  let body = data.body.content;
  if (data.body.contentType === "html") {
    body = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
  }

  return {
    subject: data.subject,
    from: `${data.from.emailAddress.name} <${data.from.emailAddress.address}>`,
    body,
    receivedAt: data.receivedDateTime,
  };
}

/** Envia um email pelo Outlook */
export async function outlookSendEmail(userId: string, opts: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<void> {
  const token = await msToken(userId);
  if (!token) throw new Error("Microsoft não conectado");

  const message = {
    subject: opts.subject,
    body: { contentType: "Text", content: opts.body },
    toRecipients: [{ emailAddress: { address: opts.to } }],
    ...(opts.cc ? { ccRecipients: [{ emailAddress: { address: opts.cc } }] } : {}),
  };

  await msFetch(token, "/me/sendMail", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/** Responde um email */
export async function outlookReplyEmail(userId: string, messageId: string, body: string): Promise<void> {
  const token = await msToken(userId);
  if (!token) throw new Error("Microsoft não conectado");

  await msFetch(token, `/me/messages/${messageId}/reply`, {
    method: "POST",
    body: JSON.stringify({ comment: body }),
  });
}

// ─── OUTLOOK CALENDAR ──────────────────────────────────────────────

interface MSEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location: { displayName: string };
  attendees: Array<{ emailAddress: { name: string; address: string } }>;
  isOnlineMeeting: boolean;
  onlineMeeting?: { joinUrl: string };
  webLink: string;
  bodyPreview: string;
}

/** Lista eventos do Outlook Calendar */
export async function outlookListEvents(userId: string, days = 7): Promise<{ events: MSEvent[] }> {
  const token = await msToken(userId);
  if (!token) return { events: [] };

  const start = new Date().toISOString();
  const end = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

  const data = await msFetch(
    token,
    `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=20&$orderby=start/dateTime&$select=id,subject,start,end,location,attendees,isOnlineMeeting,onlineMeeting,webLink,bodyPreview`,
  ) as { value: MSEvent[] };

  return { events: data.value ?? [] };
}

/** Cria evento no Outlook Calendar */
export async function outlookCreateEvent(userId: string, opts: {
  title: string;
  startDateTime: string;
  endDateTime: string;
  description?: string;
  attendees?: string[];
  location?: string;
}): Promise<{ id: string; webLink: string }> {
  const token = await msToken(userId);
  if (!token) throw new Error("Microsoft não conectado");

  const event = {
    subject: opts.title,
    start: { dateTime: opts.startDateTime, timeZone: "America/Sao_Paulo" },
    end: { dateTime: opts.endDateTime, timeZone: "America/Sao_Paulo" },
    ...(opts.description ? { body: { contentType: "Text", content: opts.description } } : {}),
    ...(opts.location ? { location: { displayName: opts.location } } : {}),
    ...(opts.attendees?.length ? {
      attendees: opts.attendees.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      })),
    } : {}),
  };

  const data = await msFetch(token, "/me/events", {
    method: "POST",
    body: JSON.stringify(event),
  }) as { id: string; webLink: string };

  return { id: data.id, webLink: data.webLink };
}

// ─── MICROSOFT TEAMS ───────────────────────────────────────────────

interface MSTeamsMessage {
  id: string;
  createdDateTime: string;
  from: { user: { displayName: string; id: string } };
  body: { content: string; contentType: string };
  importance: string;
}

interface MSTeamsChannel {
  id: string;
  displayName: string;
  description: string | null;
}

/** Lista equipes do usuário no Teams */
export async function teamsListTeams(userId: string): Promise<Array<{
  id: string;
  displayName: string;
  description: string | null;
}>> {
  const token = await msToken(userId);
  if (!token) return [];

  const data = await msFetch(token, "/me/joinedTeams?$select=id,displayName,description") as {
    value: Array<{ id: string; displayName: string; description: string | null }>;
  };

  return data.value ?? [];
}

/** Lista canais de uma equipe */
export async function teamsListChannels(userId: string, teamId: string): Promise<MSTeamsChannel[]> {
  const token = await msToken(userId);
  if (!token) return [];

  const data = await msFetch(token, `/teams/${teamId}/channels?$select=id,displayName,description`) as {
    value: MSTeamsChannel[];
  };

  return data.value ?? [];
}

/** Lista mensagens recentes de um canal */
export async function teamsListMessages(userId: string, teamId: string, channelId: string): Promise<{
  messages: Array<{ id: string; from: string; content: string; createdAt: string }>;
}> {
  const token = await msToken(userId);
  if (!token) return { messages: [] };

  const data = await msFetch(
    token,
    `/teams/${teamId}/channels/${channelId}/messages?$top=20`,
  ) as { value: MSTeamsMessage[] };

  return {
    messages: (data.value ?? []).map((m) => ({
      id: m.id,
      from: m.from?.user?.displayName ?? "Unknown",
      content: m.body.contentType === "html"
        ? m.body.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
        : m.body.content.slice(0, 500),
      createdAt: m.createdDateTime,
    })),
  };
}

/** Envia mensagem em um canal Teams */
export async function teamsSendMessage(userId: string, teamId: string, channelId: string, content: string): Promise<void> {
  const token = await msToken(userId);
  if (!token) throw new Error("Microsoft não conectado");

  await msFetch(token, `/teams/${teamId}/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: { content, contentType: "text" } }),
  });
}

// ─── ONEDRIVE ──────────────────────────────────────────────────────

/** Lista arquivos recentes do OneDrive */
export async function onedriveListRecent(userId: string): Promise<Array<{
  id: string;
  name: string;
  webUrl: string;
  lastModified: string;
  size: number;
  mimeType: string | null;
}>> {
  const token = await msToken(userId);
  if (!token) return [];

  const data = await msFetch(token, "/me/drive/recent?$top=20&$select=id,name,webUrl,lastModifiedDateTime,size,file") as {
    value: Array<{
      id: string;
      name: string;
      webUrl: string;
      lastModifiedDateTime: string;
      size: number;
      file?: { mimeType: string };
    }>;
  };

  return (data.value ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    webUrl: f.webUrl,
    lastModified: f.lastModifiedDateTime,
    size: f.size,
    mimeType: f.file?.mimeType ?? null,
  }));
}

/** Busca arquivos no OneDrive */
export async function onedriveSearch(userId: string, query: string): Promise<Array<{
  id: string;
  name: string;
  webUrl: string;
  lastModified: string;
}>> {
  const token = await msToken(userId);
  if (!token) return [];

  const data = await msFetch(
    token,
    `/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=10&$select=id,name,webUrl,lastModifiedDateTime`,
  ) as { value: Array<{ id: string; name: string; webUrl: string; lastModifiedDateTime: string }> };

  return (data.value ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    webUrl: f.webUrl,
    lastModified: f.lastModifiedDateTime,
  }));
}
