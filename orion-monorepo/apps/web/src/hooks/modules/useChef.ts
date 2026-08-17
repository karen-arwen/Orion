import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChefRecipe, ChefRecipeInput, SavedRecipe, SaveRecipeInput } from "@orion/types";
import { api } from "../../lib/api.js";

export function useChefRecipe() {
  return useMutation<ChefRecipe, Error, ChefRecipeInput>({
    mutationFn: (input) => api.chef.recipe(input),
  });
}

export function useSavedRecipes() {
  return useQuery<SavedRecipe[]>({
    queryKey: ["chef", "saved"],
    queryFn: () => api.chef.listSaved(),
  });
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation<SavedRecipe, Error, SaveRecipeInput>({
    mutationFn: (input) => api.chef.save(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chef", "saved"] }),
  });
}

export function useDeleteSavedRecipe() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => api.chef.deleteSaved(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chef", "saved"] }),
  });
}
