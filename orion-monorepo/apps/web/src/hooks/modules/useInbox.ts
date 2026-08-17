import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

const KEYS = {
  items: (f?: Record<string, string | number | undefined>) => ["inbox", "items", f] as const,
  stats: ["inbox", "stats"] as const,
};

export function useInboxItems(filters?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: KEYS.items(filters),
    queryFn: () => api.inbox.list(filters),
    refetchInterval: 30_000,
  });
}

export function useInboxStats() {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: () => api.inbox.stats(),
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.inbox.markRead(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["inbox"] }); },
  });
}

export function useMarkActed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.inbox.markActed(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["inbox"] }); },
  });
}

export function useArchiveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.inbox.archive(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["inbox"] }); },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source?: string) => api.inbox.readAll(source),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["inbox"] }); },
  });
}

export function useArchiveRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.inbox.archiveRead(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["inbox"] }); },
  });
}

export function useSyncInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.inbox.sync(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["inbox"] }); },
  });
}
