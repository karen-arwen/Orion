import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContentIdea, IdeaCreateInput } from "@orion/types";
import { api } from "../../lib/api.js";

export function useIdeas(): ReturnType<typeof useQuery<ContentIdea[]>> {
  return useQuery({
    queryKey: ["creative", "ideas"],
    queryFn: () => api.creative.list() as Promise<ContentIdea[]>,
    staleTime: 30_000,
  });
}

export function useCreateIdea(): ReturnType<typeof useMutation<ContentIdea, Error, IdeaCreateInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IdeaCreateInput) => api.creative.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["creative", "ideas"] });
    },
  });
}

export function useUpdateIdea(): ReturnType<
  typeof useMutation<ContentIdea, Error, { id: string; patch: Partial<IdeaCreateInput> }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => api.creative.update(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["creative", "ideas"] });
    },
  });
}

export function useDeleteIdea(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.creative.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["creative", "ideas"] });
    },
  });
}

export function useGenerateIdeas(): ReturnType<
  typeof useMutation<
    Array<{ title: string; body: string; format: string; tags: string[] }>,
    Error,
    { niche?: string; audience?: string; save?: boolean }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.creative.generate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["creative", "ideas"] });
    },
  });
}
