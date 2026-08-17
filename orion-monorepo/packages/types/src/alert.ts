export type AlertPriority = "low" | "medium" | "high" | "critical";

export interface ProactiveAlert {
  id: string;
  userId: string;
  module: string;
  icon: string;
  color: string;
  title: string;
  text: string;
  action: string;
  priority: AlertPriority;
  dismissed: boolean;
  createdAt: string;
}

export interface AlertScanResult {
  detection: {
    created: number;
    checked: number;
  };
  pulse: {
    checked: number;
    routed: number;
    skipped: number;
    results: Array<{
      title: string;
      status: "executed" | "decision" | "blocked";
      moduleId: string;
      reason?: string;
      decisionId?: string;
      execution?: {
        type: string;
        label: string;
        entityId: string | null;
        summary: string;
      };
    }>;
  };
}
