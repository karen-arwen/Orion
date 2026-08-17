export type SecurityRiskLevel = "low" | "medium" | "high" | "critical";

export interface SecurityAccount {
  id: string;
  service: string;
  category: string;
  email: string;
  hasTwoFactor: boolean;
  usesPasswordManager: boolean;
  passwordRotatedAt: string | null;
  recoveryCheckedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityFinding {
  id: string;
  title: string;
  detail: string;
  action: string;
  risk: SecurityRiskLevel;
  resolved: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityAccountInput {
  service: string;
  category?: string;
  email?: string;
  hasTwoFactor?: boolean;
  usesPasswordManager?: boolean;
  passwordRotatedAt?: string | null;
  recoveryCheckedAt?: string | null;
  notes?: string;
}

export interface SecurityFindingInput {
  title: string;
  detail: string;
  action: string;
  risk?: SecurityRiskLevel;
  source?: string;
}

export interface SecurityPosture {
  score: number;
  signal: "hardened" | "attention" | "exposed";
  accountsTotal: number;
  twoFactorCoverage: number;
  passwordManagerCoverage: number;
  openFindings: number;
  criticalFindings: number;
  accounts: SecurityAccount[];
  findings: SecurityFinding[];
  checklist: Array<{
    id: string;
    label: string;
    done: boolean;
    detail: string;
  }>;
  plan: Array<{
    title: string;
    detail: string;
    risk: SecurityRiskLevel;
  }>;
}
