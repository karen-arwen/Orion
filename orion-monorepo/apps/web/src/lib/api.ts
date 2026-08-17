import type {
  ApiResponse,
  Automation,
  AutonomyCore,
  AutonomyPolicy,
  AutonomyPolicyInput,
  AutomationOverview,
  CapabilityConnector,
  ChatRequest,
  ChatResponse,
  ChatFeedbackInput,
  ChefRecipe,
  ChefRecipeInput,
  SavedRecipe,
  SaveRecipeInput,
  ContentIdea,
  DecisionItem,
  DecisionApproveResult,
  DecisionQueueSummary,
  DevCommandProposal,
  DevCommandProposalInput,
  DevCodeContextMap,
  DevDebugRunbook,
  DevExecutionDiagnosis,
  DevFilePreview,
  DevPatchProposal,
  DevPatchProposalInput,
  DevWorkspaceSummary,
  DocAnalysis,
  DriveFileRow,
  EnergyLog,
  FinanceGoal,
  FinanceGoalInput,
  FinanceSubscription,
  FinanceSubscriptionInput,
  FinanceSummary,
  FinanceMonthData,
  FinanceTransaction,
  FinanceTransactionInput,
  FocusSession,
  GameCreateInput,
  GameEntry,
  Habit,
  IdeaCreateInput,
  IntelligenceProfile,
  Integration,
  LessonLevel,
  LanguagePracticeInput,
  LanguagePracticeResult,
  MediaHub,
  MediaItem,
  MediaItemInput,
  MediaRecommendation,
  MediaRecommendationInput,
  MindsetCheckinInput,
  MindsetCheckinResult,
  MemoryCreateInput,
  MemoryListResponse,
  MemoryRecord,
  MemoryType,
  MemoryUpdateInput,
  LessonSession,
  LessonSessionSummary,
  NewsItem,
  JobRadarInput,
  JobRadarResult,
  NewsSearchResult,
  OrionMode,
  AlertScanResult,
  ProactiveAlert,
  Project,
  SecurityAccount,
  SecurityAccountInput,
  SecurityFinding,
  SecurityFindingInput,
  SecurityPosture,
  SleepLog,
  SleepStats,
  SocialContact,
  SocialContactInput,
  SocialNudge,
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TravelPlan,
  TravelPlanInput,
  WishlistCreateInput,
  WishlistItem,
  WishlistUpdateInput,
  WhatIfScenario,
  WhatIfScenarioInput,
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

export interface ClassifiedEmail {
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
  onToolStart?: (tools: string[]) => void;
  onToolDone?: (results: Array<{ name: string; ok: boolean }>) => void;
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
          case "tool_start":
            if (Array.isArray(payload.tools)) handlers.onToolStart?.(payload.tools as string[]);
            break;
          case "tool_done":
            if (Array.isArray(payload.results)) handlers.onToolDone?.(payload.results as Array<{ name: string; ok: boolean }>);
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

export async function request<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string | number | boolean | undefined>; rawBody?: boolean } = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}/v1${path}`);
  if (init.params) {
    for (const [k, v] of Object.entries(init.params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const token = await tokenGetter();
  const headers = new Headers(init.headers);
  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!init.rawBody) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url.toString(), { ...init, headers, credentials: "include" });
  const body = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!body.ok) {
    throw new ApiClientError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Falha");
  }
  return body.data;
}


export interface BehavioralProfileResult {
  communicationStyle: "direct" | "elaborate" | "casual" | "formal" | "unknown";
  preferredResponseLength: "short" | "medium" | "detailed" | "unknown";
  usesHumor: boolean;
  technicalLevel: "beginner" | "intermediate" | "expert" | "unknown";
  emotionalOpenness: "low" | "medium" | "high" | "unknown";
  primaryLanguageTone: string;
  confidence: number;
  basedOnMessages: number;
  analyzedAt: string;
}

export const api = {
  // ── User ────────────────────────────────────────────────────────
  getProfile: () => request<unknown>("/user/profile"),
  getIntelligence: () => request<IntelligenceProfile>("/user/intelligence"),
  getMomentum: () => request<unknown>("/user/momentum"),
  listMemories: (params?: { type?: MemoryType; q?: string; pinned?: boolean; limit?: number }) =>
    request<MemoryListResponse>("/user/memories", { params }),
  createMemory: (input: MemoryCreateInput) =>
    request<MemoryRecord>("/user/memories", { method: "POST", body: JSON.stringify(input) }),
  updateMemory: (id: string, input: MemoryUpdateInput) =>
    request<MemoryRecord>(`/user/memories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteMemory: (id: string) => request<{ id: string }>(`/user/memories/${id}`, { method: "DELETE" }),
  setMode: (mode: OrionMode) =>
    request<{ id: string; mode: OrionMode }>("/user/mode", {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  // ── Chat ────────────────────────────────────────────────────────
  sendMessage: (req: ChatRequest) =>
    request<ChatResponse>("/chat", { method: "POST", body: JSON.stringify(req) }),
  sendChatFeedback: (input: ChatFeedbackInput) =>
    request<{ saved: boolean }>("/chat/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listConversations: () => request<Array<{ id: string; title: string | null }>>("/chat/conversations"),
  getChatHistory: (conversationId: string) =>
    request<{ id: string; messages: Array<{ id: string; role: string; content: string; createdAt: string }> }>("/chat/history", { params: { conversationId } }),
  analyzeFile: (input: { filename: string; content: string; prompt?: string }) =>
    request<{ summary: string; insights: string[]; raw?: string }>("/chat/analyze-file", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // ── Modules ─────────────────────────────────────────────────────
  listModules: () => request<unknown[]>("/modules"),
  toggleModule: (id: string, enabled: boolean) =>
    request<unknown>(`/modules/${id}/enable`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  // ── Integrations ────────────────────────────────────────────────
  listIntegrations: () => request<Integration[]>("/integrations"),
  listCapabilities: () => request<CapabilityConnector[]>("/integrations/capabilities"),
  startGoogleConnect: () => request<{ url: string }>("/integrations/google/start"),
  startNotionConnect: () => request<{ url: string }>("/integrations/notion/start"),
  disconnectIntegration: (provider: string) =>
    request<{ provider: string; disconnected: boolean }>(`/integrations/${provider}`, {
      method: "DELETE",
    }),

  // ── Automations ─────────────────────────────────────────────────
  listAutomations: () => request<Automation[]>("/automations"),
  getAutomationOverview: () => request<AutomationOverview>("/automations/overview"),
  getAutonomyCore: () => request<AutonomyCore>("/automations/autonomy-core"),
  updateAutonomyPolicy: (moduleId: string, input: AutonomyPolicyInput) =>
    request<AutonomyPolicy>(`/automations/autonomy-core/${moduleId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
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
  scanAlerts: () => request<AlertScanResult>("/alerts/scan", { method: "POST" }),
  getBehavioralProfile: () => request<BehavioralProfileResult | null>("/behavioral/profile"),
  analyzeBehavioralProfile: () => request<BehavioralProfileResult>("/behavioral/analyze", { method: "POST" }),
  approveAlert: (id: string) => request<{ id: string; action: string }>(`/alerts/${id}/approve`, { method: "POST" }),
  dismissAlert: (id: string) => request<{ id: string }>(`/alerts/${id}/dismiss`, { method: "POST" }),

  // Decisions
  listDecisions: (status: "pending" | "approved" | "dismissed" | "executed" = "pending") =>
    request<DecisionItem[]>("/decisions", { params: { status } }),
  getDecisionQueueSummary: () => request<DecisionQueueSummary>("/decisions/queue-summary"),
  syncDecisionsFromAlerts: () => request<{ created: number; pending: number }>("/decisions/sync-alerts", { method: "POST" }),
  approveDecision: (id: string) => request<DecisionApproveResult>(`/decisions/${id}/approve`, { method: "POST" }),
  dismissDecision: (id: string) => request<{ id: string }>(`/decisions/${id}/dismiss`, { method: "POST" }),

  // ── Projects ────────────────────────────────────────────────────
  listProjects: () => request<Project[]>("/projects"),

  // ── Módulos core ────────────────────────────────────────────────
  comms: {
    inbox: (filter?: "all" | "unread" | "starred") =>
      request<ClassifiedEmail[]>(`/m/comms/inbox${filter ? `?filter=${filter}` : ""}`),
    readEmail: (id: string) =>
      request<{ subject: string; from: string; date: string; body: string }>(`/m/comms/inbox/${id}`),
    draftReply: (id: string, instructions?: string) =>
      request<{ draft: string }>(`/m/comms/inbox/${id}/draft`, {
        method: "POST",
        body: JSON.stringify({ instructions }),
      }),
    sendReply: (id: string, payload: { threadId: string; to: string; subject: string; body: string }) =>
      request<{ id: string; threadId: string }>(`/m/comms/inbox/${id}/reply`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    archive: (id: string) =>
      request<{ id: string }>(`/m/comms/inbox/${id}/archive`, { method: "POST" }),
    snooze: (id: string, payload: { subject: string; from: string; snoozeUntil: string }) =>
      request<{ id: string }>(`/m/comms/inbox/${id}/snooze`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    createTask: (id: string, payload?: { customTitle?: string; dueAt?: string }) =>
      request<Record<string, unknown>>(`/m/comms/inbox/${id}/create-task`, {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      }),
    summary: () => request<{ summary: string }>("/m/comms/summary"),
  },
  agenda: {
    list: (params?: { timeMin?: string; timeMax?: string }) =>
      request<{ events: Array<Record<string, unknown>>; total: number }>("/m/agenda/events", { params: params as Record<string, string> }),
    today: () => request<{ events: CalEvent[]; conflicts: number }>("/m/agenda/today"),
    week: () => request<DayBucket[]>("/m/agenda/week"),
    focusSuggestion: () => request<{ suggestion: string }>("/m/agenda/focus-suggestion"),
  },
  life: {
    list: (filters?: Record<string, string>) => request<Task[]>("/m/life", { params: filters }),
    listAll: () => request<Task[]>("/m/life/all"),
    listByDate: (date: string) => request<Task[]>(`/m/life/by-date?date=${date}`),
    listOverdue: () => request<Task[]>("/m/life/overdue"),
    create: (input: TaskCreateInput) =>
      request<Task>("/m/life", { method: "POST", body: JSON.stringify(input) }),
    update: (input: TaskUpdateInput) =>
      request<Task>(`/m/life/${input.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => request<{ id: string }>(`/m/life/${id}`, { method: "DELETE" }),
    completeRecurring: (id: string) =>
      request<Task>(`/m/life/${id}/complete-recurring`, { method: "POST" }),
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
    uploadPdf: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<DocAnalysis>("/m/docs/upload-pdf", { method: "POST", body: form as unknown as string, rawBody: true });
    },
    history: (limit?: number) =>
      request<Array<{ id: string; fileName: string; analysis: DocAnalysis; createdAt: string }>>("/m/docs/history", { params: { limit: String(limit ?? 20) } }),
    deleteHistory: (id: string) =>
      request<{ ok: boolean }>(`/m/docs/history/${id}`, { method: "DELETE" }),
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
  media: {
    hub: () => request<MediaHub>("/m/media/hub"),
    createItem: (input: MediaItemInput) =>
      request<MediaItem>("/m/media/items", { method: "POST", body: JSON.stringify(input) }),
    updateItem: (id: string, input: Partial<MediaItemInput>) =>
      request<MediaItem>(`/m/media/items/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    removeItem: (id: string) => request<{ id: string }>(`/m/media/items/${id}`, { method: "DELETE" }),
    recommend: (input: MediaRecommendationInput) =>
      request<MediaRecommendation[]>("/m/media/recommend", { method: "POST", body: JSON.stringify(input) }),
  },
  news: {
    search: (query: string, freshness: "pd" | "pw" | "pm" = "pw") =>
      request<NewsSearchResult[]>("/m/news/search", {
        method: "POST",
        body: JSON.stringify({ query, freshness }),
      }),
    jobs: (input: JobRadarInput) =>
      request<JobRadarResult[]>("/m/news/jobs", {
        method: "POST",
        body: JSON.stringify(input),
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
  shop: {
    wishlist: () => request<WishlistItem[]>("/m/shop/wishlist"),
    create: (input: WishlistCreateInput) =>
      request<WishlistItem>("/m/shop/wishlist", { method: "POST", body: JSON.stringify(input) }),
    update: (input: WishlistUpdateInput) =>
      request<WishlistItem>(`/m/shop/wishlist/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<{ id: string }>(`/m/shop/wishlist/${id}`, { method: "DELETE" }),
  },
  travel: {
    plan: (input: TravelPlanInput) =>
      request<TravelPlan>("/m/travel/plan", { method: "POST", body: JSON.stringify(input) }),
  },
  language: {
    practice: (input: LanguagePracticeInput) =>
      request<LanguagePracticeResult>("/m/language/practice", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
  whatif: {
    scenario: (input: WhatIfScenarioInput) =>
      request<WhatIfScenario>("/m/whatif/scenario", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
  chef: {
    recipe: (input: ChefRecipeInput) =>
      request<ChefRecipe>("/m/chef/recipe", { method: "POST", body: JSON.stringify(input) }),
    save: (input: SaveRecipeInput) =>
      request<SavedRecipe>("/m/chef/saved", { method: "POST", body: JSON.stringify(input) }),
    listSaved: () => request<SavedRecipe[]>("/m/chef/saved"),
    deleteSaved: (id: string) => request<{ ok: boolean }>(`/m/chef/saved/${id}`, { method: "DELETE" }),
  },
  mindset: {
    checkin: (input: MindsetCheckinInput) =>
      request<MindsetCheckinResult>("/m/mindset/checkin", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
  social: {
    contacts: () => request<SocialContact[]>("/m/social/contacts"),
    createContact: (input: SocialContactInput) =>
      request<SocialContact>("/m/social/contacts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    nudges: () => request<SocialNudge[]>("/m/social/nudges"),
  },
  finance: {
    summary: () => request<FinanceSummary>("/m/finance/summary"),
    monthData: (month: string) => request<FinanceMonthData>(`/m/finance/month?month=${month}`),
    createTransaction: (input: FinanceTransactionInput) =>
      request<FinanceTransaction>("/m/finance/transactions", { method: "POST", body: JSON.stringify(input) }),
    createSubscription: (input: FinanceSubscriptionInput) =>
      request<FinanceSubscription>("/m/finance/subscriptions", { method: "POST", body: JSON.stringify(input) }),
    createGoal: (input: FinanceGoalInput) =>
      request<FinanceGoal>("/m/finance/goals", { method: "POST", body: JSON.stringify(input) }),
    updateGoal: (id: string, input: Partial<FinanceGoalInput>) =>
      request<FinanceGoal>(`/m/finance/goals/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    upsertBudget: (payload: { month: string; category: string; amount: number }) =>
      request<Record<string, unknown>>("/m/finance/budgets", { method: "PUT", body: JSON.stringify(payload) }),
    deleteBudget: (month: string, category: string) =>
      request<{ ok: boolean }>(`/m/finance/budgets/${month}/${category}`, { method: "DELETE" }),
    importCsv: (csv: string) =>
      request<{ imported: number; errors: number }>("/m/finance/import-csv", { method: "POST", body: JSON.stringify({ csv }) }),
  },
  security: {
    posture: () => request<SecurityPosture>("/m/security/posture"),
    createAccount: (input: SecurityAccountInput) =>
      request<SecurityAccount>("/m/security/accounts", { method: "POST", body: JSON.stringify(input) }),
    updateAccount: (id: string, input: Partial<SecurityAccountInput>) =>
      request<SecurityAccount>(`/m/security/accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    createFinding: (input: SecurityFindingInput) =>
      request<SecurityFinding>("/m/security/findings", { method: "POST", body: JSON.stringify(input) }),
    resolveFinding: (id: string) =>
      request<SecurityFinding>(`/m/security/findings/${id}/resolve`, { method: "POST" }),
  },
  dev: {
    workspace: () => request<DevWorkspaceSummary>("/m/dev/workspace"),
    contextMap: () => request<DevCodeContextMap>("/m/dev/context-map"),
    file: (path: string) => request<DevFilePreview>("/m/dev/file", { params: { path } }),
    proposal: (input: DevPatchProposalInput) =>
      request<DevPatchProposal>("/m/dev/proposal", { method: "POST", body: JSON.stringify(input) }),
    command: (input: DevCommandProposalInput) =>
      request<DevCommandProposal>("/m/dev/command", { method: "POST", body: JSON.stringify(input) }),
    diagnose: () => request<DevExecutionDiagnosis>("/m/dev/diagnose"),
    runbook: () => request<DevDebugRunbook>("/m/dev/runbook"),
    applyProposal: (id: string) =>
      request<DevPatchProposal>(`/m/dev/proposal/${id}/apply`, { method: "POST" }),
    applyCommand: (id: string) =>
      request<DevCommandProposal>(`/m/dev/command/${id}/run`, { method: "POST" }),
    recentExecutions: () => request<DevExecutionDiagnosis[]>("/m/dev/executions"),
  },
  timeline: {
    list: (filters?: Record<string, string | number | undefined>) =>
      request<{ items: Array<Record<string, unknown>>; total: number }>("/m/timeline", { params: filters as Record<string, string> }),
    stats: () => request<Record<string, unknown>>("/m/timeline/stats"),
    create: (input: Record<string, unknown>) =>
      request<Record<string, unknown>>("/m/timeline", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/m/timeline/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => request<{ deleted: boolean }>(`/m/timeline/${id}`, { method: "DELETE" }),
  },
  inbox: {
    list: (filters?: Record<string, string | number | undefined>) =>
      request<{ items: Array<Record<string, unknown>>; total: number }>("/inbox", { params: filters as Record<string, string> }),
    stats: () => request<{ total: number; unread: number; critical: number; actionable: number; bySource: Record<string, number> }>("/inbox/stats"),
    create: (input: Record<string, unknown>) =>
      request<Record<string, unknown>>("/inbox", { method: "POST", body: JSON.stringify(input) }),
    sync: () => request<Record<string, number>>("/inbox/sync", { method: "POST" }),
    markRead: (id: string) => request<Record<string, unknown>>(`/inbox/${id}/read`, { method: "PATCH" }),
    markActed: (id: string) => request<Record<string, unknown>>(`/inbox/${id}/acted`, { method: "PATCH" }),
    snooze: (id: string, until: string) => request<Record<string, unknown>>(`/inbox/${id}/snooze`, { method: "PATCH", body: JSON.stringify({ until }) }),
    dismiss: (id: string) => request<Record<string, unknown>>(`/inbox/${id}/dismiss`, { method: "DELETE" }),
    archive: (id: string) => request<Record<string, unknown>>(`/inbox/${id}/archive`, { method: "PATCH" }),
    readAll: (source?: string) => request<Record<string, unknown>>("/inbox/read-all", { method: "PATCH", body: JSON.stringify({ source }) }),
    archiveRead: () => request<Record<string, unknown>>("/inbox/archive-read", { method: "PATCH" }),
  },
  onboarding: {
    status: () => request<{ onboarded: boolean }>("/onboarding/status"),
    complete: (input: Record<string, unknown>) =>
      request<{ ok: boolean }>("/onboarding/complete", { method: "POST", body: JSON.stringify(input) }),
  },
  search: {
    global: (q: string) =>
      request<{ results: Array<{ type: string; id: string; title: string; subtitle?: string; module: string; icon: string; score: number }> }>("/search", { params: { q } }),
  },
  quest: {
    profile: () =>
      request<{ totalXp: number; level: number; levelName: string; xpToNext: number; xpProgress: number; achievements: Array<{ id: string; title: string; description: string; icon: string; rarity: string; xpReward: number; unlockedAt?: string }>; activeQuests: Array<{ id: string; title: string; description: string; icon: string; xpReward: number; type: string; progress: number; target: number; completed: boolean; expiresAt?: string }>; recentXpLog: Array<{ action: string; xp: number; ts: string; module?: string }> }>("/m/quest/profile"),
    award: (action: string, xp: number, module?: string) =>
      request<{ xp: number; newAchievements: unknown[] }>("/m/quest/award", { method: "POST", body: JSON.stringify({ action, xp, module }) }),
    progress: (questId: string, increment?: number) =>
      request<{ ok: boolean }>("/m/quest/progress", { method: "POST", body: JSON.stringify({ questId, increment }) }),
  },
  routines: {
    list: () => request<Array<{ id: string; name: string; icon: string; description?: string; frequency: string; steps: Array<{ id: string; label: string; type: string; durationMin?: number }>; active: boolean; createdAt: string; totalXp: number }>>("/m/routines"),
    get: (id: string) => request<{ id: string; name: string; icon: string; steps: Array<{ id: string; label: string; type: string; durationMin?: number }>; active: boolean; frequency: string; totalXp: number }>(`/m/routines/${id}`),
    create: (input: Record<string, unknown>) => request<{ id: string; name: string; icon: string; steps: Array<{ id: string; label: string; type: string }>; active: boolean; frequency: string; totalXp: number }>("/m/routines", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: Record<string, unknown>) => request<{ id: string }>(`/m/routines/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) => request<{ ok: boolean }>(`/m/routines/${id}`, { method: "DELETE" }),
    start: (id: string) => request<{ routineId: string; date: string; completedSteps: string[]; finished: boolean; startedAt: string }>(`/m/routines/${id}/start`, { method: "POST" }),
    completeStep: (id: string, stepId: string) => request<{ routineId: string; date: string; completedSteps: string[]; finished: boolean; startedAt: string; finishedAt?: string; streak?: number }>(`/m/routines/${id}/step/${stepId}`, { method: "POST" }),
    today: (id: string) => request<{ routineId: string; date: string; completedSteps: string[]; finished: boolean; startedAt: string } | null>(`/m/routines/${id}/today`),
    history: (id: string, days?: number) => request<Array<{ routineId: string; date: string; completedSteps: string[]; finished: boolean; streak?: number }>>(`/m/routines/${id}/history`, { params: { days: String(days ?? 30) } }),
    nudge: (id: string) => request<{ message: string }>(`/m/routines/${id}/nudge`),
  },
  journal: {
    list: (days?: number) =>
      request<Array<{ date: string; mood: number; energy: number; gratitude: string[]; highlight: string; challenge: string; reflection: string; intentions: string[]; tags: string[]; createdAt: string; updatedAt: string }>>("/m/journal", { params: { days: String(days ?? 30) } }),
    today: () =>
      request<{ date: string; mood: number; energy: number; gratitude: string[]; highlight: string; challenge: string; reflection: string; intentions: string[]; tags: string[]; createdAt: string; updatedAt: string } | null>("/m/journal/today"),
    stats: () =>
      request<{ streak: number; totalEntries: number; avgMood: number; avgEnergy: number; topTags: Array<{ tag: string; count: number }>; moodHistory: Array<{ date: string; mood: number; energy: number }> }>("/m/journal/stats"),
    get: (date: string) =>
      request<{ date: string; mood: number; energy: number; gratitude: string[]; highlight: string; challenge: string; reflection: string; intentions: string[]; tags: string[]; createdAt: string; updatedAt: string }>(`/m/journal/${date}`),
    save: (input: Record<string, unknown>) =>
      request<{ date: string; mood: number; energy: number; gratitude: string[]; highlight: string; challenge: string; reflection: string; intentions: string[]; tags: string[]; createdAt: string; updatedAt: string }>("/m/journal", { method: "POST", body: JSON.stringify(input) }),
    insight: (date: string) =>
      request<{ date: string; summary: string; patterns: string[]; suggestions: string[]; affirmation: string; generatedAt: string }>(`/m/journal/${date}/insight`, { method: "POST" }),
    getInsight: (date: string) =>
      request<{ date: string; summary: string; patterns: string[]; suggestions: string[]; affirmation: string; generatedAt: string } | null>(`/m/journal/${date}/insight`),
    remove: (date: string) =>
      request<{ ok: boolean }>(`/m/journal/${date}`, { method: "DELETE" }),
  },
  projects: {
    list: () =>
      request<Array<{ id: string; name: string; color: string; progress: number; status: string; createdAt: string; updatedAt: string; meta: { description?: string; dueDate?: string; startDate?: string; tags: string[]; priority: string; lastActivityAt: string }; milestones: Array<{ id: string; title: string; completed: boolean; dueDate?: string; order: number; completedAt?: string }>; updates: Array<{ id: string; note: string; progressDelta?: number; createdAt: string }>; isStalled: boolean; stalledDays: number; nextMilestone?: { id: string; title: string; dueDate?: string }; completedMilestones: number; totalMilestones: number }>>("/m/projects"),
    get: (id: string) =>
      request<{ id: string; name: string; color: string; progress: number; status: string; meta: { description?: string; dueDate?: string; tags: string[]; priority: string }; milestones: Array<{ id: string; title: string; completed: boolean; dueDate?: string; order: number }>; updates: Array<{ id: string; note: string; progressDelta?: number; createdAt: string }>; isStalled: boolean; stalledDays: number }>(`/m/projects/${id}`),
    stalled: () =>
      request<Array<{ projectId: string; name: string; stalledDays: number; suggestion: string }>>("/m/projects/stalled"),
    create: (input: Record<string, unknown>) =>
      request<{ id: string; name: string }>("/m/projects", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: Record<string, unknown>) =>
      request<{ id: string; progress: number; status: string }>(`/m/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/m/projects/${id}`, { method: "DELETE" }),
    addMilestone: (id: string, input: { title: string; description?: string; dueDate?: string }) =>
      request<{ id: string; title: string; completed: boolean }>(`/m/projects/${id}/milestones`, { method: "POST", body: JSON.stringify(input) }),
    completeMilestone: (id: string, msId: string) =>
      request<{ id: string; completed: boolean }>(`/m/projects/${id}/milestones/${msId}/complete`, { method: "POST" }),
    removeMilestone: (id: string, msId: string) =>
      request<{ ok: boolean }>(`/m/projects/${id}/milestones/${msId}`, { method: "DELETE" }),
  },
};
