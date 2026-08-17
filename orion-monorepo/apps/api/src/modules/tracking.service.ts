import { prisma } from "../db/prisma.js";

/**
 * Package & Flight Tracking — rastreio real-time de encomendas e voos.
 */

// ── Package Tracking ──────────────────────────────────────────────

interface PackageInput {
  userId: string;
  trackingCode: string;
  carrier: string;     // correios, fedex, ups, amazon, etc.
  description?: string;
  estimatedDelivery?: Date;
  metadata?: Record<string, unknown>;
}

/** Criar rastreio de encomenda */
export async function trackPackage(input: PackageInput) {
  // Deduplica por código
  const existing = await prisma.packageTracking.findFirst({
    where: { userId: input.userId, trackingCode: input.trackingCode },
  });
  if (existing) return existing;

  return prisma.packageTracking.create({
    data: {
      userId: input.userId,
      trackingCode: input.trackingCode,
      carrier: input.carrier,
      description: input.description,
      status: "pending",
      estimatedDelivery: input.estimatedDelivery,
      metadata: input.metadata ?? {},
      events: [],
    },
  });
}

/** Listar encomendas do usuário */
export async function listPackages(userId: string, status?: string) {
  return prisma.packageTracking.findMany({
    where: { userId, ...(status && { status }) },
    orderBy: { updatedAt: "desc" },
  });
}

/** Atualizar status do pacote (chamado pelo sync ou manualmente) */
export async function updatePackageStatus(
  userId: string,
  id: string,
  status: string,
  event?: { date: Date; location: string; description: string },
) {
  const pkg = await prisma.packageTracking.findUniqueOrThrow({ where: { id, userId } });
  const events = (pkg.events as Array<Record<string, unknown>>) ?? [];
  if (event) events.push(event);

  return prisma.packageTracking.update({
    where: { id },
    data: {
      status,
      events,
      ...(status === "delivered" && { deliveredAt: new Date() }),
    },
  });
}

/** Remover rastreio */
export async function removePackageTracking(userId: string, id: string) {
  return prisma.packageTracking.delete({ where: { id, userId } });
}

// ── Flight Tracking ───────────────────────────────────────────────

interface FlightInput {
  userId: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: Date;
  arrivalDate?: Date;
  metadata?: Record<string, unknown>;
}

/** Criar rastreio de voo */
export async function trackFlight(input: FlightInput) {
  return prisma.flightTracking.create({
    data: {
      userId: input.userId,
      flightNumber: input.flightNumber,
      airline: input.airline,
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
      arrivalDate: input.arrivalDate,
      status: "scheduled",
      metadata: input.metadata ?? {},
    },
  });
}

/** Listar voos do usuário */
export async function listFlights(userId: string, upcoming = true) {
  return prisma.flightTracking.findMany({
    where: {
      userId,
      ...(upcoming && { departureDate: { gte: new Date() } }),
    },
    orderBy: { departureDate: "asc" },
  });
}

/** Atualizar status do voo */
export async function updateFlightStatus(userId: string, id: string, status: string, metadata?: Record<string, unknown>) {
  return prisma.flightTracking.update({
    where: { id, userId },
    data: {
      status,
      ...(metadata && { metadata }),
    },
  });
}

/** Remover rastreio de voo */
export async function removeFlightTracking(userId: string, id: string) {
  return prisma.flightTracking.delete({ where: { id, userId } });
}

// ── Price History ─────────────────────────────────────────────────

interface PriceEntry {
  userId: string;
  itemId: string;       // wishlist item id
  itemName: string;
  store: string;
  price: number;
  currency?: string;
  url?: string;
}

/** Registrar preço */
export async function recordPrice(input: PriceEntry) {
  return prisma.priceHistory.create({
    data: {
      userId: input.userId,
      itemId: input.itemId,
      itemName: input.itemName,
      store: input.store,
      price: input.price,
      currency: input.currency ?? "BRL",
      url: input.url,
    },
  });
}

/** Histórico de preços de um item */
export async function getPriceHistory(userId: string, itemId: string, limit = 100) {
  return prisma.priceHistory.findMany({
    where: { userId, itemId },
    orderBy: { recordedAt: "desc" },
    take: limit,
  });
}

/** Listar todos os items com tracking de preço */
export async function listTrackedPrices(userId: string) {
  const items = await prisma.priceHistory.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });

  // Agrupar por itemId com último preço e variação
  const byItem = new Map<string, { itemName: string; store: string; current: number; min: number; max: number; history: number[]; lastCheck: Date }>();

  for (const entry of items) {
    const existing = byItem.get(entry.itemId);
    if (!existing) {
      byItem.set(entry.itemId, {
        itemName: entry.itemName,
        store: entry.store,
        current: Number(entry.price),
        min: Number(entry.price),
        max: Number(entry.price),
        history: [Number(entry.price)],
        lastCheck: entry.recordedAt,
      });
    } else {
      const p = Number(entry.price);
      existing.history.push(p);
      existing.min = Math.min(existing.min, p);
      existing.max = Math.max(existing.max, p);
    }
  }

  return Array.from(byItem.entries()).map(([itemId, data]) => ({
    itemId,
    ...data,
    trend: data.history.length >= 2
      ? data.history[0]! < data.history[data.history.length - 1]!
        ? "down" : data.history[0]! > data.history[data.history.length - 1]!
          ? "up" : "stable"
      : "unknown",
  }));
}
