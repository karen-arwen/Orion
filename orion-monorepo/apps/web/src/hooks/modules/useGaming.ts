import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameCreateInput, GameEntry } from "@orion/types";
import { api } from "../../lib/api.js";

export function useGames(status?: string): ReturnType<typeof useQuery<GameEntry[]>> {
  return useQuery({
    queryKey: ["gaming", "list", status],
    queryFn: () => api.gaming.list(status) as Promise<GameEntry[]>,
    staleTime: 30_000,
  });
}

export function useAddGame(): ReturnType<typeof useMutation<GameEntry, Error, GameCreateInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GameCreateInput) => api.gaming.add(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gaming"] });
    },
  });
}

export function useUpdateGame(): ReturnType<
  typeof useMutation<
    GameEntry,
    Error,
    {
      id: string;
      patch: Partial<GameCreateInput> & { hoursPlayed?: number; rating?: number; notes?: string };
    }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => api.gaming.update(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gaming"] });
    },
  });
}

export function useDeleteGame(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.gaming.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gaming"] });
    },
  });
}

export function useSearchGames(): ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof api.gaming.search>>, Error, string>
> {
  return useMutation({
    mutationFn: (q: string) => api.gaming.search(q),
  });
}
