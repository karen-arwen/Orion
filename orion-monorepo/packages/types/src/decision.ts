export type DecisionStatus = "pending" | "approved" | "dismissed" | "executed";

export interface DecisionItem {
  id: string;
  userId: string;
  source: string;
  sourceId: string | null;
  title: string;
  summary: string;
  proposedAction: string;
  payload: Record<string, unknown>;
  priority: "low" | "medium" | "high" | "critical";
  status: DecisionStatus;
  dedupKey: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
}

export interface DecisionCreateInput {
  source: string;
  sourceId?: string;
  title: string;
  summary: string;
  proposedAction: string;
  payload?: Record<string, unknown>;
  priority?: "low" | "medium" | "high" | "critical";
  dedupKey?: string;
}

export type InternalActionType =
  | "memory.create"
  | "task.create"
  | "alert.create"
  | "project.create"
  | "project.update"
  | "social.contact.create"
  | "finance.transaction.create"
  | "finance.subscription.create"
  | "finance.goal.create"
  | "shop.wishlist.create"
  | "media.item.create"
  | "security.finding.create"
  | "habit.create";

export type ExternalActionType =
  | "slack.post_message"
  | "todoist.create_task"
  | "linear.create_issue"
  | "workspace.write_file"
  | "workspace.patch_file"
  | "workspace.run_command";

export interface InternalActionDescriptor {
  type: InternalActionType;
  input: Record<string, unknown>;
}

export interface DecisionApproveResult {
  id: string;
  action: string;
  executed: boolean;
  execution?: {
    type: InternalActionType | ExternalActionType;
    label: string;
    entityId: string | null;
    summary: string;
  };
}

export interface DecisionQueueSummary {
  pending: number;
  approved: number;
  executed: number;
  dismissed: number;
  criticalPending: number;
  recent: DecisionItem[];
}
