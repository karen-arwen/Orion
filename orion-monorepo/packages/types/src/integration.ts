export type IntegrationProvider =
  | "gmail"
  | "gcal"
  | "gdrive"
  | "notion"
  | "slack"
  | "spotify"
  | "booking";

export type IntegrationStatus = "connected" | "expired" | "revoked" | "error";

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  scopes: string[];
  mcpUrl: string;
  connectedAt: string;
  lastUsedAt: string | null;
}

export interface McpServer {
  type: "url";
  url: string;
  name: string;
  authorization_token?: string;
}
