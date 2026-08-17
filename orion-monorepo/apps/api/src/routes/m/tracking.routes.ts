import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  trackPackage, listPackages, updatePackageStatus, removePackageTracking,
  trackFlight, listFlights, updateFlightStatus, removeFlightTracking,
  recordPrice, getPriceHistory, listTrackedPrices,
} from "../../modules/tracking.service.js";

export const trackingRouter: Router = Router();

// ── Packages ──────────────────────────────────────────────────────

trackingRouter.get("/packages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const data = await listPackages(req.user.id, status);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

trackingRouter.post("/packages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const s = z.object({
      trackingCode: z.string().min(1),
      carrier: z.string().min(1),
      description: z.string().optional(),
      estimatedDelivery: z.string().transform((s) => new Date(s)).optional(),
    }).parse(req.body);
    const pkg = await trackPackage({ userId: req.user.id, ...s });
    res.status(201).json({ ok: true, data: pkg });
  } catch (err) { next(err); }
});

trackingRouter.patch("/packages/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { status, event } = req.body;
    const pkg = await updatePackageStatus(req.user.id, req.params.id, status, event);
    res.json({ ok: true, data: pkg });
  } catch (err) { next(err); }
});

trackingRouter.delete("/packages/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    await removePackageTracking(req.user.id, req.params.id);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

// ── Flights ───────────────────────────────────────────────────────

trackingRouter.get("/flights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const upcoming = req.query.upcoming !== "false";
    const data = await listFlights(req.user.id, upcoming);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

trackingRouter.post("/flights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const s = z.object({
      flightNumber: z.string().min(1),
      airline: z.string().min(1),
      origin: z.string().min(1),
      destination: z.string().min(1),
      departureDate: z.string().transform((s) => new Date(s)),
      arrivalDate: z.string().transform((s) => new Date(s)).optional(),
    }).parse(req.body);
    const flight = await trackFlight({ userId: req.user.id, ...s });
    res.status(201).json({ ok: true, data: flight });
  } catch (err) { next(err); }
});

trackingRouter.patch("/flights/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { status, metadata } = req.body;
    const flight = await updateFlightStatus(req.user.id, req.params.id, status, metadata);
    res.json({ ok: true, data: flight });
  } catch (err) { next(err); }
});

trackingRouter.delete("/flights/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    await removeFlightTracking(req.user.id, req.params.id);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

// ── Price History ─────────────────────────────────────────────────

trackingRouter.get("/prices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = await listTrackedPrices(req.user.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

trackingRouter.get("/prices/:itemId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = await getPriceHistory(req.user.id, req.params.itemId);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

trackingRouter.post("/prices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const s = z.object({
      itemId: z.string(),
      itemName: z.string(),
      store: z.string(),
      price: z.number(),
      currency: z.string().default("BRL"),
      url: z.string().optional(),
    }).parse(req.body);
    const entry = await recordPrice({ userId: req.user.id, ...s });
    res.status(201).json({ ok: true, data: entry });
  } catch (err) { next(err); }
});
