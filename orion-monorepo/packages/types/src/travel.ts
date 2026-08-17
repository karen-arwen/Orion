export interface TravelPlanInput {
  destination: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  days: number;
  budget: "baixo" | "medio" | "alto";
  pace: "leve" | "equilibrado" | "intenso";
  interests: string[];
  constraints?: string;
}

export interface TravelPlan {
  destination: string;
  summary: string;
  assumptions: string[];
  days: Array<{
    day: number;
    title: string;
    morning: string;
    afternoon: string;
    night: string;
    logistics: string;
  }>;
  risks: string[];
  nextActions: string[];
}
