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
