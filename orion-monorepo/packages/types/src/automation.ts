export type TriggerType =
  | "cron"
  | "temporal"
  | "event"
  | "behavioral"
  | "contextual"
  | "manual";

export type AutomationStatus =
  | "success"
  | "failed"
  | "pending"
  | "skipped"
  | "pending_confirmation"
  | "confirmed"
  | "executed"
  | "dismissed";

export interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export interface Automation {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  conditions: Record<string, unknown> | null;
  actions: AutomationAction[];
  requiresConfirmation: boolean;
  confirmationTimeout: number;
  enabled: boolean;
  lastTriggered: string | null;
  templateKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  triggeredAt: string;
  status: AutomationStatus;
  result: Record<string, unknown>;
  userResponse: string | null;
  executionMs: number | null;
}

export interface AutomationOverview {
  total: number;
  enabled: number;
  pendingAlerts: number;
  criticalAlerts: number;
  last24hRuns: number;
  failedLast24h: number;
  autonomyScore: number;
  mode: "SILENCIOSO" | "NORMAL" | "STARK";
  recent: Array<{
    id: string;
    automationId: string;
    automationName: string;
    status: AutomationStatus;
    triggeredAt: string;
    executionMs: number | null;
  }>;
}

export type AutonomyLevel = "observe" | "suggest" | "draft" | "confirm" | "execute";

export interface AutonomyPolicy {
  id: string;
  userId: string;
  moduleId: string;
  level: AutonomyLevel;
  enabled: boolean;
  requiresConfirmation: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  maxDailyActions: number;
  rules: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutonomyPolicyInput {
  level?: AutonomyLevel;
  enabled?: boolean;
  requiresConfirmation?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  maxDailyActions?: number;
  rules?: string[];
}

export type AutonomyRouteStatus = "executed" | "decision" | "blocked";

export interface AutonomyActionLog {
  id: string;
  userId: string;
  moduleId: string;
  actionType: string;
  title: string;
  status: AutonomyRouteStatus;
  reason: string | null;
  decisionId: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface AutonomyCore {
  policies: AutonomyPolicy[];
  recentActions: AutonomyActionLog[];
  modulesObserved: number;
  modulesExecutable: number;
  confirmationRequired: number;
  lockedDown: number;
  recommended: Array<{
    moduleId: string;
    level: AutonomyLevel;
    reason: string;
  }>;
}
