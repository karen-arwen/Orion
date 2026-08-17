import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WishlistCreateInput, WishlistItem, WishlistUpdateInput } from "@orion/types";
import { api } from "../../lib/api.js";

export function useWishlist(): ReturnType<typeof useQuery<WishlistItem[]>> {
  return useQuery({
    queryKey: ["shop", "wishlist"],
    queryFn: () => api.shop.wishlist(),
    staleTime: 30_000,
  });
}

export function useCreateWishlistItem(): ReturnType<
  typeof useMutation<WishlistItem, Error, WishlistCreateInput>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.shop.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["shop"] }),
  });
}

export function useUpdateWishlistItem(): ReturnType<
  typeof useMutation<WishlistItem, Error, WishlistUpdateInput>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.shop.update(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["shop"] }),
  });
}

export function useRemoveWishlistItem(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.shop.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["shop"] }),
  });
}
