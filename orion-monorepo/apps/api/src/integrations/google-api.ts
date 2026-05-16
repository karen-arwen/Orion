/* ═══════════════════════════════════════════════════════════════════
   Cliente REST do Google — Gmail / Calendar / Drive.

   Cada função recebe um access_token (vivo, renovado pelo
   token-manager) e devolve dados já formatados pro O.R.I.O.N.

   Não usa MCP. Não usa biblioteca pesada do Google. Só fetch + REST.
   Lean, tipado, testável.
═══════════════════════════════════════════════════════════════════ */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR = "https://www.googleapis.com/calendar/v3";
const DRIVE = "https://www.googleapis.com/drive/v3";

interface RequestOpts {
  accessToken: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | undefined>;
}

async function request<T>(url: string, opts: RequestOpts): Promise<T> {
  const u = new URL(url);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) u.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(u.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status} em ${u.pathname}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ── GMAIL ──────────────────────────────────────────────────────────

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

interface GmailRawMessage {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

function headerValue(msg: GmailRawMessage, name: string): string {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

/** Lista os N emails mais recentes (com filtro opcional estilo Gmail: "is:unread", "from:fulano", etc). */
export async function gmailList(
  accessToken: string,
  opts: { query?: string; maxResults?: number } = {},
): Promise<GmailMessageSummary[]> {
  const list = await request<GmailListResponse>(`${GMAIL}/messages`, {
    accessToken,
    query: { q: opts.query, maxResults: opts.maxResults ?? 10 },
  });
  if (!list.messages || list.messages.length === 0) return [];

  // Busca o resumo (metadata) de cada mensagem em paralelo
  const details = await Promise.all(
    list.messages.map((m) =>
      request<GmailRawMessage>(`${GMAIL}/messages/${m.id}`, {
        accessToken,
        query: { format: "metadata", "metadataHeaders": "From" },
      }).then(async (base) => {
        // Pega From, Subject, Date também
        const full = await request<GmailRawMessage>(`${GMAIL}/messages/${m.id}`, {
          accessToken,
          query: { format: "metadata" },
        });
        return full;
      }),
    ),
  );

  return details.map<GmailMessageSummary>((msg) => ({
    id: msg.id,
    threadId: msg.threadId,
    from: headerValue(msg, "From"),
    subject: headerValue(msg, "Subject") || "(sem assunto)",
    date: headerValue(msg, "Date"),
    snippet: msg.snippet ?? "",
    unread: msg.labelIds?.includes("UNREAD") ?? false,
  }));
}

/** Lê o corpo de um email específico (texto plano, decodificado). */
export async function gmailRead(
  accessToken: string,
  messageId: string,
): Promise<{ subject: string; from: string; date: string; body: string }> {
  interface FullMessage extends GmailRawMessage {
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: GmailMessagePart[];
    };
  }
  const msg = await request<FullMessage>(`${GMAIL}/messages/${messageId}`, {
    accessToken,
    query: { format: "full" },
  });

  // Extrai o body — Gmail aninha parts; pegamos o text/plain mais externo
  const findText = (parts?: GmailMessagePart[]): string => {
    if (!parts) return "";
    for (const p of parts) {
      if (p.mimeType === "text/plain" && p.body?.data) {
        return Buffer.from(p.body.data, "base64url").toString("utf-8");
      }
      const nested = findText(p.parts);
      if (nested) return nested;
    }
    return "";
  };

  const body =
    findText(msg.payload?.parts) ||
    (msg.payload?.body?.data
      ? Buffer.from(msg.payload.body.data, "base64url").toString("utf-8")
      : "") ||
    msg.snippet ||
    "";

  return {
    subject: headerValue(msg, "Subject"),
    from: headerValue(msg, "From"),
    date: headerValue(msg, "Date"),
    body: body.slice(0, 4000), // cap pra não estourar o contexto do Claude
  };
}

function encodeMime(opts: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push("", opts.body);
  return Buffer.from(lines.join("\r\n"), "utf-8").toString("base64url");
}

/** Cria um rascunho (NÃO envia — usuário precisa confirmar). */
export async function gmailDraft(
  accessToken: string,
  opts: { to: string; subject: string; body: string },
): Promise<{ id: string }> {
  const encoded = encodeMime(opts);
  const result = await request<{ id: string }>(`${GMAIL}/drafts`, {
    accessToken,
    method: "POST",
    body: { message: { raw: encoded } },
  });
  return { id: result.id };
}

/** ENVIA um email. Caller é responsável por confirmar com o usuário ANTES. */
export async function gmailSend(
  accessToken: string,
  opts: { to: string; subject: string; body: string },
): Promise<{ id: string; threadId: string }> {
  const encoded = encodeMime(opts);
  const result = await request<{ id: string; threadId: string }>(`${GMAIL}/messages/send`, {
    accessToken,
    method: "POST",
    body: { raw: encoded },
  });
  return result;
}

/** Responde uma thread mantendo cabeçalhos (In-Reply-To / References). */
export async function gmailReply(
  accessToken: string,
  opts: { threadId: string; messageId: string; to: string; subject: string; body: string },
): Promise<{ id: string; threadId: string }> {
  const subject = opts.subject.toLowerCase().startsWith("re:") ? opts.subject : `Re: ${opts.subject}`;
  const encoded = encodeMime({
    to: opts.to,
    subject,
    body: opts.body,
    inReplyTo: opts.messageId,
    references: opts.messageId,
  });
  const result = await request<{ id: string; threadId: string }>(`${GMAIL}/messages/send`, {
    accessToken,
    method: "POST",
    body: { raw: encoded, threadId: opts.threadId },
  });
  return result;
}

// ── CALENDAR ───────────────────────────────────────────────────────

export interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string;
  attendees: string[];
  meetingUrl: string | null;
  description: string;
}

interface CalendarApiEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
}

interface CalendarListResponse {
  items: CalendarApiEvent[];
}

/** Lista eventos do calendário primário entre duas datas ISO. */
export async function calendarList(
  accessToken: string,
  opts: { timeMin: string; timeMax: string; maxResults?: number } = {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  },
): Promise<CalEvent[]> {
  const data = await request<CalendarListResponse>(`${CALENDAR}/calendars/primary/events`, {
    accessToken,
    query: {
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      maxResults: opts.maxResults ?? 20,
      singleEvents: "true",
      orderBy: "startTime",
    },
  });

  return (data.items ?? []).map<CalEvent>((e) => {
    const video =
      e.hangoutLink ||
      e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ||
      null;
    return {
      id: e.id,
      summary: e.summary ?? "(sem título)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      location: e.location ?? "",
      attendees: (e.attendees ?? []).map((a) => a.email),
      meetingUrl: video,
      description: (e.description ?? "").slice(0, 500),
    };
  });
}

/** Cria evento no calendário primário. */
export async function calendarCreate(
  accessToken: string,
  opts: {
    summary: string;
    startISO: string;
    endISO: string;
    description?: string;
    location?: string;
    attendees?: string[];
  },
): Promise<{ id: string; htmlLink: string }> {
  const result = await request<{ id: string; htmlLink: string }>(
    `${CALENDAR}/calendars/primary/events`,
    {
      accessToken,
      method: "POST",
      body: {
        summary: opts.summary,
        description: opts.description,
        location: opts.location,
        start: { dateTime: opts.startISO },
        end: { dateTime: opts.endISO },
        attendees: opts.attendees?.map((email) => ({ email })),
      },
    },
  );
  return result;
}

// ── DRIVE ──────────────────────────────────────────────────────────

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

interface DriveListResponse {
  files: DriveFileSummary[];
}

/** Busca arquivos por nome/conteúdo. */
export async function driveSearch(
  accessToken: string,
  query: string,
  maxResults = 10,
): Promise<DriveFileSummary[]> {
  // q sintaxe do Drive: name contains 'X' or fullText contains 'X'
  const escaped = query.replace(/'/g, "\\'");
  const q = `name contains '${escaped}' or fullText contains '${escaped}'`;
  const data = await request<DriveListResponse>(`${DRIVE}/files`, {
    accessToken,
    query: {
      q,
      pageSize: maxResults,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    },
  });
  return data.files ?? [];
}

/** Lê texto de um Google Doc (exporta como text/plain). */
export async function driveReadDoc(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE}/files/${fileId}/export?mimeType=text/plain`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive export ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text.slice(0, 4000);
}

export async function driveRecent(
  accessToken: string,
  opts: { mimePrefix?: string; maxResults?: number } = {},
): Promise<DriveFileSummary[]> {
  const q = opts.mimePrefix ? `mimeType contains '${opts.mimePrefix.replace(/'/g, "\\'")}'` : undefined;
  const data = await request<DriveListResponse>(`${DRIVE}/files`, {
    accessToken,
    query: {
      q,
      pageSize: opts.maxResults ?? 20,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    },
  });
  return data.files ?? [];
}

export async function driveReadFileText(
  accessToken: string,
  fileId: string,
  mimeType: string,
): Promise<string> {
  const exportable: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  const exportMime = exportable[mimeType];
  const url = exportMime
    ? `${DRIVE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `${DRIVE}/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive read ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text.slice(0, 16000);
}
