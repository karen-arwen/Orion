import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { generateRecipe, saveRecipe, listSavedRecipes, deleteSavedRecipe } from "../../modules/chef.service.js";

export const chefRouter: Router = Router();

const recipeSchema = z.object({
  ingredients: z.array(z.string().min(1).max(60)).min(1).max(20),
  goal: z.enum(["rapido", "saudavel", "barato", "comfort", "high_protein"]),
  restrictions: z.string().max(800).optional(),
  servings: z.number().int().min(1).max(10),
});

const saveSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000),
  prepMinutes: z.number().int().min(1).max(600),
  servings: z.number().int().min(1).max(20),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  swaps: z.array(z.string()),
  shoppingList: z.array(z.string()),
  goal: z.string(),
  rating: z.number().int().min(0).max(5),
  notes: z.string().max(2000).optional(),
});

chefRouter.post("/recipe", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const data = await generateRecipe(req.user.id, recipeSchema.parse(req.body));
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

chefRouter.post("/saved", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const data = await saveRecipe(req.user.id, saveSchema.parse(req.body));
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

chefRouter.get("/saved", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const data = await listSavedRecipes(req.user.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

chefRouter.delete("/saved/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await deleteSavedRecipe(req.user.id, req.params.id!);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
