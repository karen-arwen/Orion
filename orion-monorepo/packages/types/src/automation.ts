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
  createdAt: string;
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
