import type {
  ApiResponse,
  Automation,
  ChatRequest,
  ChatResponse,
  Integration,
  LessonLevel,
  LessonSession,
  LessonSessionSummary,
  OrionMode,
  ProactiveAlert,
  Project,
  Task,
  TaskCreateInput,
  TaskUpdateInput,
} from "@orion/types";

interface ClassifiedEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
  urgency: "urgent" | "relevant" | "noise";
  reason: string;
}

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string;
  attendees: string[];
  meetingUrl: string | null;
  description: string;
}

interface DayBucket {
  date: string;
  weekday: string;
  events: CalEvent[];
}

/* ═══════════════════════════════════════════════════════════════════
   API client tipado.
   Token: o getToken vem do Clerk e é injetado a cada request.
   Erro: descompacta {ok:false, error} e lança ApiClientError tipado.
═══════════════════════════════════════════════════════════════════ */

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter = async () => null;

/** Chamar uma vez no boot (provider Clerk) pra cravar o getter. */
export function setTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

async function request<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}/v1${path}`);
  if (init.params) {
    for (const [k, v] of Object.entries(init.params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const token = await tokenGetter();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url.toString(), { ...init, headers, credentials: "include" });
  const body = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!body.ok) {
    throw new ApiClientError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Falha");
  }
  return body.data;
}

export const api = {
  // ── User ────────────────────────────────────────────────────────
  getProfile: () => request<unknown>("/user/profile"),
  setMode: (mode: OrionMode) =>
    request<{ id: string; mode: OrionMode }>("/user/mode", {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  // ── Chat ────────────────────────────────────────────────────────
  sendMessage: (req: ChatRequest) =>
    request<ChatResponse>("/chat", { method: "POST", body: JSON.stringify(req) }),
  listConversations: () => request<Array<{ id: string; title: string | null }>>("/chat/conversations"),

  // ── Modules ─────────────────────────────────────────────────────
  listModules: () => request<unknown[]>("/modules"),
  toggleModule: (id: string, enabled: boolean) =>
    request<unknown>(`/modules/${id}/enable`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  // ── Integrations ────────────────────────────────────────────────
  listIntegrations: () => request<Integration[]>("/integrations"),
  startGoogleConnect: () => request<{ url: string }>("/integrations/google/start"),
  disconnectIntegration: (provider: string) =>
    request<{ provider: string; disconnected: boolean }>(`/integrations/${provider}`, {
      method: "DELETE",
    }),

  // ── Automations ─────────────────────────────────────────────────
  listAutomations: () => request<Automation[]>("/automations"),
  triggerMorningBrief: () =>
    request<{ triggered: boolean }>("/automations/morning-brief/now", { method: "POST" }),

  // ── Alerts ──────────────────────────────────────────────────────
  listAlerts: () => request<ProactiveAlert[]>("/alerts"),
  approveAlert: (id: string) => request<{ id: string; action: string }>(`/alerts/${id}/approve`, { method: "POST" }),
  dismissAlert: (id: string) => request<{ id: string }>(`/alerts/${id}/dismiss`, { method: "POST" }),

  // ── Projects ────────────────────────────────────────────────────
  listProjects: () => request<Project[]>("/projects"),

  // ── Módulos core ────────────────────────────────────────────────
  comms: {
    inbox: () => request<ClassifiedEmail[]>("/m/comms/inbox"),
    summary: () => request<{ summary: string }>("/m/comms/summary"),
  },
  agenda: {
    today: () => request<{ events: CalEvent[]; conflicts: number }>("/m/agenda/today"),
    week: () => request<DayBucket[]>("/m/agenda/week"),
    focusSuggestion: () => request<{ suggestion: string }>("/m/agenda/focus-suggestion"),
  },
  life: {
    list: () => request<Task[]>("/m/life"),
    listAll: () => request<Task[]>("/m/life/all"),
    create: (input: TaskCreateInput) =>
      request<Task>("/m/life", { method: "POST", body: JSON.stringify(input) }),
    update: (input: TaskUpdateInput) =>
      request<Task>(`/m/life/${input.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => request<{ id: string }>(`/m/life/${id}`, { method: "DELETE" }),
    suggestNext: (currentEnergy: 1 | 2 | 3) =>
      request<{ suggestion: string }>("/m/life/suggest-next", {
        method: "POST",
        body: JSON.stringify({ currentEnergy }),
      }),
  },
  know: {
    ask: (input: { question: string; depth?: "rapido" | "padrao" | "fundo"; context?: string }) =>
      request<
        | { kind: "answer"; answer: string }
        | { kind: "lesson"; lesson: LessonSession }
      >("/m/know/ask", { method: "POST", body: JSON.stringify(input) }),
    createLesson: (input: { topic: string; level?: LessonLevel }) =>
      request<LessonSession>("/m/know/lessons", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listLessons: () => request<LessonSessionSummary[]>("/m/know/lessons"),
    getLesson: (id: string) => request<LessonSession & { messages: Array<{ id: string; role: string; content: string; createdAt: string }> }>(`/m/know/lessons/${id}`),
    continueLesson: (id: string, question: string) =>
      request<{ answer: string }>(`/m/know/lessons/${id}/continue`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
    deleteLesson: (id: string) =>
      request<{ id: string }>(`/m/know/lessons/${id}`, { method: "DELETE" }),
  },
  career: {
    coach: (input: {
      prompt: string;
      mode?: "portfolio" | "entrevista" | "plano_90" | "review" | "livre";
    }) =>
      request<{ answer: string }>("/m/career/coach", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
};
