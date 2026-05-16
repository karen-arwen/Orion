export type TriggerType =
  | "temporal"
  | "event"
  | "behavioral"
  | "contextual"
  | "manual";

export type AutomationStatus = "success" | "failed" | "pending" | "skipped";

export interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export interface Automation {
  id: string;
  userId: string;
  name: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  actions: AutomationAction[];
  enabled: boolean;
  createdAt: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  triggeredAt: string;
  status: AutomationStatus;
  result: Record<string, unknown>;
}
