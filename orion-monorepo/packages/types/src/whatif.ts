export interface WhatIfScenarioInput {
  question: string;
  horizon: "7d" | "30d" | "90d" | "1y";
  constraints?: string;
}

export interface WhatIfScenario {
  question: string;
  executiveSummary: string;
  assumptions: string[];
  likelyOutcome: string;
  bestCase: string;
  worstCase: string;
  leadingIndicators: string[];
  decisionMatrix: Array<{
    option: string;
    upside: string;
    downside: string;
    effort: "baixo" | "medio" | "alto";
    confidence: number;
  }>;
  nextActions: string[];
}
