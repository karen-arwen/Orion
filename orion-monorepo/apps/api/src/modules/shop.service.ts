import type { WishlistCreateInput, WishlistItem, WishlistUpdateInput } from "@orion/types";
import { prisma } from "../db/prisma.js";

function toItem(row: Awaited<ReturnType<typeof prisma.wishlistItem.findMany>>[number]): WishlistItem {
  const history = Array.isArray(row.priceHistory)
    ? (row.priceHistory as Array<{ price: number; at: string }>)
    : [];
  const firstPrice = history.find((h) => typeof h.price === "number")?.price ?? row.currentPrice ?? null;
  const current = row.currentPrice ?? null;
  const dropPct =
    firstPrice && current ? Math.max(0, Math.round(((firstPrice - current) / firstPrice) * 100)) : null;
  const targetHit = row.targetPrice !== null && current !== null && current <= row.targetPrice;
  const dropHit = dropPct !== null && dropPct >= row.alertAtPct;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    url: row.url,
    targetPrice: row.targetPrice,
    currentPrice: row.currentPrice,
    priceHistory: history,
    alertAtPct: row.alertAtPct,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dropPct,
    shouldAlert: Boolean(targetHit || dropHit),
  };
}

function historyWith(price?: number): Array<{ price: number; at: string }> {
  return typeof price === "number" ? [{ price, at: new Date().toISOString() }] : [];
}

export async function listWishlist(userId: string): Promise<WishlistItem[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });
  return rows.map(toItem);
}

export async function createWishlistItem(userId: string, input: WishlistCreateInput): Promise<WishlistItem> {
  const row = await prisma.wishlistItem.create({
    data: {
      userId,
      name: input.name,
      url: input.url,
      targetPrice: input.targetPrice ?? null,
      currentPrice: input.currentPrice ?? null,
      priceHistory: historyWith(input.currentPrice),
      alertAtPct: input.alertAtPct ?? 20,
      notes: input.notes ?? null,
    },
  });
  return toItem(row);
}

export async function updateWishlistItem(userId: string, input: WishlistUpdateInput): Promise<WishlistItem> {
  const owned = await prisma.wishlistItem.findFirst({ where: { id: input.id, userId } });
  if (!owned) throw new Error("Item não encontrado");
  const history = Array.isArray(owned.priceHistory)
    ? (owned.priceHistory as Array<{ price: number; at: string }>)
    : [];
  const nextHistory =
    input.currentPrice !== undefined && input.currentPrice !== owned.currentPrice
      ? [...history, { price: input.currentPrice, at: new Date().toISOString() }]
      : history;
  const row = await prisma.wishlistItem.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.url !== undefined && { url: input.url }),
      ...(input.targetPrice !== undefined && { targetPrice: input.targetPrice }),
      ...(input.currentPrice !== undefined && { currentPrice: input.currentPrice }),
      ...(input.currentPrice !== undefined && { priceHistory: nextHistory }),
      ...(input.alertAtPct !== undefined && { alertAtPct: input.alertAtPct }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });
  return toItem(row);
}

export async function deleteWishlistItem(userId: string, id: string): Promise<void> {
  const owned = await prisma.wishlistItem.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Item não encontrado");
  await prisma.wishlistItem.delete({ where: { id } });
}
