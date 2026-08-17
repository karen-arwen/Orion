import { z } from "zod";
import { env } from "../config/env.js";

const NOTION_AUTH_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const NOTION_VERSION = "2026-03-11";

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  bot_id: z.string().min(1),
  workspace_id: z.string().min(1),
  workspace_name: z.string().nullable().optional(),
  workspace_icon: z.string().nullable().optional(),
  duplicated_template_id: z.string().nullable().optional(),
});

export interface NotionTokenResult {
  accessToken: string;
  refreshToken: string;
  botId: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
  duplicatedTemplateId: string | null;
}

function requireNotionOAuth(): { clientId: string; clientSecret: string } {
  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
    throw new Error("NOTION_OAUTH_NOT_CONFIGURED");
  }
  return { clientId: env.NOTION_CLIENT_ID, clientSecret: env.NOTION_CLIENT_SECRET };
}

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
}

export function getNotionAuthUrl(state: string): string {
  const { clientId } = requireNotionOAuth();
  const url = new URL(NOTION_AUTH_URL);
  url.searchParams.set("owner", "user");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", env.NOTION_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeNotionCode(code: string): Promise<NotionTokenResult> {
  const { clientId, clientSecret } = requireNotionOAuth();
  const response = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.NOTION_REDIRECT_URI,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const detail = json && typeof json === "object" && "error" in json ? String(json.error) : response.statusText;
    throw new Error(`notion_token_exchange_failed:${detail}`);
  }

  const parsed = tokenSchema.parse(json);
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    botId: parsed.bot_id,
    workspaceId: parsed.workspace_id,
    workspaceName: parsed.workspace_name ?? null,
    workspaceIcon: parsed.workspace_icon ?? null,
    duplicatedTemplateId: parsed.duplicated_template_id ?? null,
  };
}
