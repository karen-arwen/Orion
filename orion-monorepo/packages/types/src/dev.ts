export interface DevWorkspaceSummary {
  root: string;
  files: Array<{
    path: string;
    ext: string;
    size: number;
  }>;
  counts: {
    total: number;
    byExt: Record<string, number>;
  };
}

export interface DevFilePreview {
  path: string;
  content: string;
  truncated: boolean;
}

export interface DevPatchProposalInput {
  title: string;
  summary: string;
  path: string;
  content?: string;
  mode?: "create" | "replace" | "patch";
  operations?: DevSearchReplaceOperation[];
}

export interface DevPatchProposal {
  decisionId: string;
  path: string;
  mode: "create" | "replace" | "patch";
  preview: string;
}

export interface DevSearchReplaceOperation {
  search: string;
  replace: string;
  replaceAll?: boolean;
}

export interface DevCommandProposalInput {
  title: string;
  summary: string;
  command: "npm" | "git";
  args: string[];
  cwd?: string;
}

export interface DevCommandProposal {
  decisionId: string;
  commandLine: string;
  cwd: string;
}

export interface DevExecutionDiagnosis {
  hasExecution: boolean;
  decisionId: string | null;
  label: string;
  exitCode: number | null;
  primaryError: string | null;
  files: Array<{
    path: string;
    line?: number;
    column?: number;
    code?: string;
    message: string;
  }>;
  suggestedNextSteps: string[];
  rawSummary: string;
}

export interface DevDebugRunbook {
  title: string;
  status: "idle" | "pass" | "fail";
  diagnosis: DevExecutionDiagnosis;
  steps: Array<{
    id: string;
    label: string;
    detail: string;
    kind: "inspect" | "patch" | "validate" | "review";
    target?: string;
    command?: DevCommandProposalInput;
  }>;
}

export interface DevCodeContextMap {
  generatedAt: string;
  totals: {
    files: number;
    apiRoutes: number;
    apiServices: number;
    webPages: number;
    webHooks: number;
    sharedTypes: number;
  };
  api: {
    routes: DevContextEntry[];
    services: DevContextEntry[];
    ai: DevContextEntry[];
    integrations: DevContextEntry[];
  };
  web: {
    pages: DevContextEntry[];
    modulePages: DevContextEntry[];
    hooks: DevContextEntry[];
    components: DevContextEntry[];
    stores: DevContextEntry[];
  };
  shared: {
    types: DevContextEntry[];
  };
  recommendations: string[];
}

export interface DevContextEntry {
  path: string;
  name: string;
  kind: string;
  area: string;
}
