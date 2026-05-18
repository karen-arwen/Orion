import type {
  ApiResponse,
  Automation,
  ChatRequest,
  ChatResponse,
  ContentIdea,
  DocAnalysis,
  DriveFileRow,
  EnergyLog,
  FocusSession,
  GameCreateInput,
  GameEntry,
  Habit,
  IdeaCreateInput,
  Integration,
  LessonLevel,
  LessonSession,
  LessonSessionSummary,
  NewsItem,
  NewsSearchResult,
  OrionMode,
  ProactiveAlert,
  Project,
  SleepLog,
  SleepStats,
  Task,
  TaskCreateInput,
  TaskUpdateInput,
} from "@orion/types";

interface HabitWithLogs extends Habit {
  recentLogs: Record<string, boolean>;
}

interface EnergyHeatmapCell {
  date: string;
  hour: number;
  avg: number;
  samples: number;
}

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

// ── STREAMING CHAT ──────────────────────────────────────────────────

interface StreamHandlers {
  onMeta: (conversationId: string) => void;
  onText: (chunk: string) => void;
  onFallback: () => void;
  onError: (msg: string) => void;
}

/**
 * Consome /v1/chat/stream via fetch+ReadableStream (suporta header Authorization,
 * o EventSource nativo não suporta).
 */
export async function streamChat(
  body: { message: string; conversationId?: string; module?: string },
  handlers: StreamHandlers,
): Promise<void> {
  const token = await (async () => {
    // Reusa o tokenGetter já cravado pelo ClerkTokenBridge
    return tokenGetter();
  })();

  const res = await fetch(`${BASE_URL}/v1/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!res.ok || !res.body) {
    handlers.onError(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE separa eventos por \n\n
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? ""; // último pode estar incompleto

    for (const evt of events) {
      const line = evt.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
        switch (payload.type) {
          case "open":
            break;
          case "meta":
            if (typeof payload.conversationId === "string") handlers.onMeta(payload.conversationId);
            break;
          case "text":
            if (typeof payload.value === "string") handlers.onText(payload.value);
            break;
          case "done":
            return;
          case "fallback_to_tools":
            handlers.onFallback();
            return;
          case "error":
            handlers.onError(typeof payload.message === "string" ? payload.message : "stream error");
            return;
        }
      } catch {
        // ignora linhas mal formadas
      }
    }
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
  getAutomation: (id: string) => request<Automation>(`/automations/${id}`),
  createAutomation: (input: {
    name: string;
    description?: string;
    triggerType: "cron" | "event" | "behavioral" | "contextual" | "manual";
    triggerConfig: Record<string, unknown>;
    conditions?: Record<string, unknown> | null;
    actions: Array<{ type: string; config: Record<string, unknown> }>;
    requiresConfirmation?: boolean;
    enabled?: boolean;
  }) => request<Automation>("/automations", { method: "POST", body: JSON.stringify(input) }),
  updateAutomation: (id: string, input: Partial<{
    name: string;
    description: string;
    triggerConfig: Record<string, unknown>;
    conditions: Record<string, unknown> | null;
    actions: Array<{ type: string; config: Record<string, unknown> }>;
    requiresConfirmation: boolean;
    enabled: boolean;
  }>) => request<Automation>(`/automations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAutomation: (id: string) =>
    request<{ id: string }>(`/automations/${id}`, { method: "DELETE" }),
  triggerAutomation: (id: string) =>
    request<{ logId: string; status: string; executionMs: number | null }>(
      `/automations/${id}/trigger`,
      { method: "POST" },
    ),
  seedDefaultAutomations: () =>
    request<Automation[]>("/automations/seed-defaults", { method: "POST" }),
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

  // ── F2: módulos novos ───────────────────────────────────────────
  docs: {
    analyze: (input: { text: string; hint?: string }) =>
      request<DocAnalysis>("/m/docs/analyze", { method: "POST", body: JSON.stringify(input) }),
    analyzeDrive: (fileId: string) =>
      request<DocAnalysis>("/m/docs/analyze-drive", {
        method: "POST",
        body: JSON.stringify({ fileId }),
      }),
    recent: (query?: string) =>
      request<DriveFileRow[]>("/m/docs/recent", { params: { q: query } }),
  },
  health: {
    log: (value: number, note?: string) =>
      request<{ id: string }>("/m/health/energy", {
        method: "POST",
        body: JSON.stringify({ value, note }),
      }),
    today: () => request<EnergyLog[]>("/m/health/today"),
    heatmap: () =>
      request<{ cells: EnergyHeatmapCell[]; lowEnergyHour: number | null }>("/m/health/heatmap"),
  },
  focus: {
    start: (duration?: number, note?: string) =>
      request<{ id: string; duration: number; startedAt: string }>("/m/focus/start", {
        method: "POST",
        body: JSON.stringify({ duration: duration ?? 25, note }),
      }),
    complete: (id: string) =>
      request<{ id: string; actualMinutes: number }>(`/m/focus/${id}/complete`, {
        method: "POST",
      }),
    interrupt: (id: string) =>
      request<{ id: string; actualMinutes: number }>(`/m/focus/${id}/interrupt`, {
        method: "POST",
      }),
    today: () => request<FocusSession[]>("/m/focus/today"),
    weekly: () => request<Array<{ date: string; minutes: number }>>("/m/focus/weekly"),
  },
  habits: {
    list: () => request<HabitWithLogs[]>("/m/habits"),
    create: (input: { name: string; frequency?: string; color?: string; icon?: string }) =>
      request<{ id: string }>("/m/habits", { method: "POST", body: JSON.stringify(input) }),
    toggle: (id: string) =>
      request<{ checked: boolean; streak: number; bestStreak: number }>(
        `/m/habits/${id}/toggle`,
        { method: "POST" },
      ),
    remove: (id: string) => request<{ id: string }>(`/m/habits/${id}`, { method: "DELETE" }),
  },

  // ── F2 leva 3 ──────────────────────────────────────────────────
  creative: {
    list: () => request<ContentIdea[]>("/m/creative"),
    create: (input: IdeaCreateInput) =>
      request<ContentIdea>("/m/creative", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: Partial<IdeaCreateInput>) =>
      request<ContentIdea>(`/m/creative/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) => request<{ id: string }>(`/m/creative/${id}`, { method: "DELETE" }),
    generate: (input: { niche?: string; audience?: string; save?: boolean }) =>
      request<Array<{ title: string; body: string; format: string; tags: string[] }>>(
        "/m/creative/generate",
        { method: "POST", body: JSON.stringify(input) },
      ),
  },
  gaming: {
    list: (status?: string) => request<GameEntry[]>("/m/gaming", { params: { status } }),
    add: (input: GameCreateInput) =>
      request<GameEntry>("/m/gaming", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: Partial<GameCreateInput> & { hoursPlayed?: number; rating?: number; notes?: string }) =>
      request<GameEntry>(`/m/gaming/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) => request<{ id: string }>(`/m/gaming/${id}`, { method: "DELETE" }),
    search: (q: string) =>
      request<Array<{
        rawgId: number;
        title: string;
        platform: string;
        genre: string;
        coverUrl: string | null;
        releasedAt: string | null;
        rating: number;
      }>>("/m/gaming/search", { params: { q } }),
  },
  news: {
    search: (query: string, freshness: "pd" | "pw" | "pm" = "pw") =>
      request<NewsSearchResult[]>("/m/news/search", {
        method: "POST",
        body: JSON.stringify({ query, freshness }),
      }),
    save: (item: { title: string; url: string; summary?: string; source?: string; category?: string }) =>
      request<NewsItem>("/m/news/save", { method: "POST", body: JSON.stringify(item) }),
    saved: () => request<NewsItem[]>("/m/news/saved"),
    markRead: (id: string) => request<{ id: string }>(`/m/news/${id}/read`, { method: "POST" }),
    remove: (id: string) => request<{ id: string }>(`/m/news/${id}`, { method: "DELETE" }),
  },
  sleep: {
    log: (input: { bedTime: string; wakeTime: string; quality: number; notes?: string }) =>
      request<SleepLog>("/m/sleep/log", { method: "POST", body: JSON.stringify(input) }),
    recent: () => request<SleepLog[]>("/m/sleep/recent"),
    stats: () => request<SleepStats>("/m/sleep/stats"),
  },

  onboarding: {
    status: () =>
      request<{ onboarded: boolean; onboardedAt: string | null }>("/onboarding/status"),
    complete: (input: {
      mode: OrionMode;
      primaryModule: string;
      workArea: string;
      hobbies: string[];
      goal: string;
    }) =>
      request<{ onboarded: boolean }>("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
};
