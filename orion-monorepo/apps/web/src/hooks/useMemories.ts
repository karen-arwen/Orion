import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemoryCreateInput, MemoryListResponse, MemoryRecord, MemoryType, MemoryUpdateInput } from "@orion/types";
import { api } from "../lib/api.js";

export interface MemoryFilters {
  type?: MemoryType;
  q?: string;
  pinned?: boolean;
  limit?: number;
}

export function useMemories(filters: MemoryFilters) {
  return useQuery<MemoryListResponse>({
    queryKey: ["memories", filters],
    queryFn: () => api.listMemories(filters),
  });
}

export function useCreateMemory() {
  const qc = useQueryClient();
  return useMutation<MemoryRecord, Error, MemoryCreateInput>({
    mutationFn: (input) => api.createMemory(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      void qc.invalidateQueries({ queryKey: ["intelligence"] });
    },
  });
}

export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation<MemoryRecord, Error, { id: string; input: MemoryUpdateInput }>({
    mutationFn: ({ id, input }) => api.updateMemory(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      void qc.invalidateQueries({ queryKey: ["intelligence"] });
    },
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: (id) => api.deleteMemory(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      void qc.invalidateQueries({ queryKey: ["intelligence"] });
    },
  });
}
