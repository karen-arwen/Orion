import type { ChefRecipe, ChefRecipeInput } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { generateJson } from "./ai-json.js";

const SYSTEM = `Voce e O.R.I.O.N. no modulo CHEF.
Crie receitas praticas com ingredientes disponiveis, substituicoes e lista de compras.
Nao invente informacao medica. Responda APENAS JSON valido no schema pedido.`;

function fallback(input: ChefRecipeInput): ChefRecipe {
  return {
    title: "Prato rapido com o que tem",
    summary: "Base simples para cozinhar agora e ajustar pelo chat.",
    prepMinutes: 25,
    servings: input.servings,
    ingredients: input.ingredients,
    steps: ["Separar ingredientes", "Cozinhar a base", "Ajustar tempero", "Finalizar e servir"],
    swaps: ["Troque proteina por ovos, frango ou grao-de-bico conforme disponibilidade."],
    shoppingList: [],
  };
}

export async function generateRecipe(userId: string, input: ChefRecipeInput): Promise<ChefRecipe> {
  const memories = await prisma.memory.findMany({
    where: { userId, OR: [{ type: "preference" }, { type: "feedback" }] },
    orderBy: { importance: "desc" },
    take: 8,
  });
  const payload = {
    userContext: { preferences: memories.map((m) => m.content) },
    request: input,
    schema: {
      title: "string",
      summary: "string",
      prepMinutes: 25,
      servings: 2,
      ingredients: ["string"],
      steps: ["string"],
      swaps: ["string"],
      shoppingList: ["string"],
    },
  };
  try {
    return await generateJson<ChefRecipe>(SYSTEM, payload, 1600);
  } catch {
    return fallback(input);
  }
}

export async function saveRecipe(userId: string, input: {
  title: string; summary: string; prepMinutes: number; servings: number;
  ingredients: unknown; steps: unknown; swaps: unknown; shoppingList: unknown;
  goal: string; rating: number; notes?: string;
}) {
  return prisma.savedRecipe.create({
    data: {
      userId,
      title: input.title,
      summary: input.summary,
      prepMinutes: input.prepMinutes,
      servings: input.servings,
      ingredients: input.ingredients as never,
      steps: input.steps as never,
      swaps: input.swaps as never,
      shoppingList: input.shoppingList as never,
      goal: input.goal,
      rating: input.rating,
      notes: input.notes ?? null,
    },
  });
}

export async function listSavedRecipes(userId: string) {
  return prisma.savedRecipe.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteSavedRecipe(userId: string, id: string) {
  const owned = await prisma.savedRecipe.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Receita nao encontrada");
  return prisma.savedRecipe.delete({ where: { id } });
}
