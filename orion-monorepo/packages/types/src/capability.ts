export type CapabilityProvider =
  | "gmail"
  | "gcal"
  | "gdrive"
  | "github"
  | "notion"
  | "slack"
  | "openweather"
  | "spotify"
  | "todoist"
  | "linear";

export interface CapabilityAction {
  id: string;
  label: string;
  kind: "read" | "write" | "execute";
  requiresDecision: boolean;
}

export interface CapabilityConnector {
  provider: CapabilityProvider;
  label: string;
  category: "workspace" | "developer" | "life" | "media" | "productivity";
  status: "connected" | "configured" | "setup_required" | "planned";
  setupKind: "oauth" | "api_key" | "manual" | "built_in";
  docsUrl: string;
  envVars: string[];
  scopes: string[];
  actions: CapabilityAction[];
  examples: string[];
  notes: string;
}
