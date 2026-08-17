import webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   WEB PUSH SERVICE — envia notificacoes nativas ao browser.

   Usa web-push (RFC 8030 + VAPID). O frontend registra a subscription
   (endpoint + keys), o backend envia com assinatura VAPID.

   Gerar VAPID keys:
     npx web-push generate-vapid-keys
   Salvar no .env como VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY
═══════════════════════════════════════════════════════════════════ */

// Configure VAPID
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:orion@orionapp.dev",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  alertId?: string;
  module?: string;
  renotify?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

/** Salva ou atualiza a push subscription do usuario */
export async function savePushSubscription(userId: string, subscription: PushSubscriptionData): Promise<void> {
  await prisma.userPreference.upsert({
    where: {
      userId_key_layer: { userId, key: "push_subscription", layer: "current" },
    },
    update: {
      value: JSON.stringify(subscription),
      updatedAt: new Date(),
    },
    create: {
      userId,
      key: "push_subscription",
      value: JSON.stringify(subscription),
      layer: "current",
      confidence: 1,
    },
  });
}

/** Remove push subscription */
export async function removePushSubscription(userId: string): Promise<void> {
  await prisma.userPreference.deleteMany({
    where: { userId, key: "push_subscription" },
  }).catch(() => {});
}

/** Envia push notification para um usuario */
export async function sendPushNotification(userId: string, payload: PushPayload): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured — storing as alert fallback");
    return createAlertFallback(userId, payload);
  }

  const pref = await prisma.userPreference.findFirst({
    where: { userId, key: "push_subscription" },
  });

  if (!pref) {
    // No subscription — create alert as fallback
    return createAlertFallback(userId, payload);
  }

  let subscription: PushSubscriptionData;
  try {
    subscription = JSON.parse(pref.value) as PushSubscriptionData;
  } catch {
    return false;
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      { TTL: 86400 }, // 24h
    );
    console.log(`[push] Sent to ${userId}: ${payload.title}`);
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    console.warn(`[push] Failed (${status}):`, (err as Error).message);

    // 404/410 = subscription expired
    if (status === 404 || status === 410) {
      await removePushSubscription(userId);
    }

    // Fallback to alert
    return createAlertFallback(userId, payload);
  }
}

/** Cria alert no banco como fallback quando push falha */
async function createAlertFallback(userId: string, payload: PushPayload): Promise<boolean> {
  await prisma.proactiveAlert.create({
    data: {
      userId,
      module: payload.module ?? "system",
      icon: "PSH",
      color: "#00D4FF",
      title: payload.title,
      text: payload.body,
      action: payload.url ?? "/",
      priority: "medium",
      dedupKey: `push_${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  }).catch(() => {});
  return true;
}

/** Envia push para todos os usuarios (broadcast) */
export async function broadcastPush(payload: PushPayload): Promise<number> {
  const users = await prisma.userPreference.findMany({
    where: { key: "push_subscription" },
    select: { userId: true },
  });

  let sent = 0;
  for (const { userId } of users) {
    const ok = await sendPushNotification(userId, payload);
    if (ok) sent++;
  }
  return sent;
}

/** Retorna a VAPID public key para o frontend */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}
