export interface ChefRecipeInput {
  ingredients: string[];
  goal: "rapido" | "saudavel" | "barato" | "comfort" | "high_protein";
  restrictions?: string;
  servings: number;
}

export interface ChefRecipe {
  title: string;
  summary: string;
  prepMinutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  swaps: string[];
  shoppingList: string[];
}

export interface SavedRecipe extends ChefRecipe {
  id: string;
  userId: string;
  goal: string;
  rating: number;
  notes: string | null;
  createdAt: string;
}

export interface SaveRecipeInput {
  title: string;
  summary: string;
  prepMinutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  swaps: string[];
  shoppingList: string[];
  goal: string;
  rating: number;
  notes?: string;
}
