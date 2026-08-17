import crypto from "node:crypto";
import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { createDecision } from "../decisions/decision.service.js";

type WebhookProvider = "github" | "linear" | "slack";

interface NormalizedWebhook {
  provider: WebhookProvider;
  eventId: string | null;
  eventType: string;
  externalAccountId: string | null;
  payload: Record<string, unknown>;
}

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer;
  }
}

function firstHeader(req: Request, name: string): string | null {
  const value = req.header(name);
  return value && value.trim().length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(source[key]);
}

function rawBody(req: Request): Buffer {
  if (req.rawBody) return req.rawBody;
  return Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
}

function timingSafeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyHexSignature(secret: string | undefined, raw: Buffer, signature: string | null): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return timingSafeEqualText(expected, signature);
}

function verifyGitHub(req: Request): boolean {
  const signature = firstHeader(req, "x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;
  return verifyHexSignature(env.GITHUB_WEBHOOK_SECRET, rawBody(req), signature.slice("sha256=".length));
}

function verifyLinear(req: Request): boolean {
  const ok = verifyHexSignature(env.LINEAR_WEBHOOK_SECRET, rawBody(req), firstHeader(req, "linear-signature"));
  if (!ok) return false;
  const payload = asRecord(req.body);
  const timestamp = typeof payload.webhookTimestamp === "number" ? payload.webhookTimestamp : 0;
  return timestamp > 0 && Math.abs(Date.now() - timestamp) <= 60_000;
}

function verifySlack(req: Request): boolean {
  const timestamp = firstHeader(req, "x-slack-request-timestamp");
  const signature = firstHeader(req, "x-slack-signature");
  if (!env.SLACK_SIGNING_SECRET || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody(req).toString("utf8")}`;
  const expected = `v0=${crypto.createHmac("sha256", env.SLACK_SIGNING_SECRET).update(base).digest("hex")}`;
  return timingSafeEqualText(expected, signature);
}

function normalizeGitHub(req: Request): NormalizedWebhook {
  const payload = asRecord(req.body);
  const repository = nestedRecord(payload, "repository");
  return {
    provider: "github",
    eventId: firstHeader(req, "x-github-delivery"),
    eventType: firstHeader(req, "x-github-event") ?? "unknown",
    externalAccountId: typeof repository.full_name === "string" ? repository.full_name : null,
    payload,
  };
}

function normalizeLinear(req: Request): NormalizedWebhook {
  const payload = asRecord(req.body);
  return {
    provider: "linear",
    eventId: firstHeader(req, "linear-delivery") ?? (typeof payload.webhookId === "string" ? payload.webhookId : null),
    eventType: firstHeader(req, "linear-event") ?? (typeof payload.type === "string" ? payload.type : "unknown"),
    externalAccountId: typeof payload.organizationId === "string" ? payload.organizationId : null,
    payload,
  };
}

function normalizeSlack(req: Request): NormalizedWebhook {
  const payload = asRecord(req.body);
  const event = nestedRecord(payload, "event");
  return {
    provider: "slack",
    eventId: typeof payload.event_id === "string" ? payload.event_id : null,
    eventType: typeof event.type === "string" ? event.type : typeof payload.type === "string" ? payload.type : "unknown",
    externalAccountId: typeof payload.team_id === "string" ? payload.team_id : null,
    payload,
  };
}

async function findSingleUserForProvider(provider: WebhookProvider): Promise<string | null> {
  const compatibleProvider = provider === "slack" ? "slack" : null;
  if (!compatibleProvider) return null;
  const users = await prisma.integration.findMany({
    where: { provider: compatibleProvider, status: "connected" },
    select: { userId: true },
    distinct: ["userId"],
    take: 2,
  });
  return users.length === 1 ? users[0]?.userId ?? null : null;
}

function titleForEvent(event: NormalizedWebhook): string {
  const action = typeof event.payload.action === "string" ? event.payload.action : "evento";
  return `${event.provider.toUpperCase()} ${event.eventType}: ${action}`;
}

async function maybeCreateDecision(userId: string | null, event: NormalizedWebhook): Promise<void> {
  if (!userId) return;
  const tracked = new Set(["issues", "pull_request", "workflow_run", "Issue", "Comment", "app_mention", "message"]);
  if (!tracked.has(event.eventType)) return;
  await createDecision(userId, {
    source: `webhook:${event.provider}`,
    sourceId: event.eventId ?? undefined,
    title: titleForEvent(event),
    summary: `Evento recebido de ${event.externalAccountId ?? event.provider}. O Orion registrou o contexto e aguardara sua decisao antes de agir fora do app.`,
    proposedAction: "Analisar evento recebido e sugerir a proxima acao segura.",
    priority: event.eventType === "workflow_run" ? "high" : "medium",
    dedupKey: `webhook:${event.provider}:${event.eventId ?? crypto.randomUUID()}`,
    payload: event.payload,
  });
}

export async function recordWebhookEvent(event: NormalizedWebhook): Promise<{ id: string; mapped: boolean }> {
  const userId = await findSingleUserForProvider(event.provider);
  const data = {
    provider: event.provider,
    eventId: event.eventId,
    eventType: event.eventType,
    externalAccountId: event.externalAccountId,
    userId,
    payload: event.payload as Prisma.InputJsonValue,
    status: userId ? "mapped" : "unmapped",
    processedAt: new Date(),
  };
  const row =
    event.eventId === null
      ? await prisma.webhookEvent.create({ data })
      : await prisma.webhookEvent.upsert({
          where: { provider_eventId: { provider: event.provider, eventId: event.eventId } },
          create: data,
          update: { ...data, receivedAt: new Date() },
        });
  await maybeCreateDecision(userId, event);
  return { id: row.id, mapped: Boolean(userId) };
}

export async function handleGitHubWebhook(req: Request): Promise<{ id: string; mapped: boolean }> {
  if (!verifyGitHub(req)) throw new Error("INVALID_WEBHOOK_SIGNATURE");
  return recordWebhookEvent(normalizeGitHub(req));
}

export async function handleLinearWebhook(req: Request): Promise<{ id: string; mapped: boolean }> {
  if (!verifyLinear(req)) throw new Error("INVALID_WEBHOOK_SIGNATURE");
  return recordWebhookEvent(normalizeLinear(req));
}

export async function handleSlackWebhook(req: Request): Promise<{ id: string; mapped: boolean; challenge?: string }> {
  if (!verifySlack(req)) throw new Error("INVALID_WEBHOOK_SIGNATURE");
  const payload = asRecord(req.body);
  if (payload.type === "url_verification" && typeof payload.challenge === "string") {
    return { id: "slack-url-verification", mapped: false, challenge: payload.challenge };
  }
  return recordWebhookEvent(normalizeSlack(req));
}
