import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

const KEYS = {
  today: ["journal", "today"] as const,
  list: (days?: number) => ["journal", "list", days] as const,
  stats: ["journal", "stats"] as const,
  entry: (date: string) => ["journal", "entry", date] as const,
  insight: (date: string) => ["journal", "insight", date] as const,
};

export function useJournalToday() {
  return useQuery({
    queryKey: KEYS.today,
    queryFn: () => api.journal.today(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useJournalList(days = 30) {
  return useQuery({
    queryKey: KEYS.list(days),
    queryFn: () => api.journal.list(days),
    staleTime: 1000 * 60 * 5,
  });
}

export function useJournalStats() {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: () => api.journal.stats(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useJournalEntry(date: string) {
  return useQuery({
    queryKey: KEYS.entry(date),
    queryFn: () => api.journal.get(date),
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
}

export function useJournalInsight(date: string, enabled = false) {
  return useQuery({
    queryKey: KEYS.insight(date),
    queryFn: () => api.journal.getInsight(date),
    enabled: !!date && enabled,
    staleTime: Infinity,
  });
}

export function useSaveJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.journal.save(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

export function useGenerateInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.journal.insight(date),
    onSuccess: (_data, date) => {
      void qc.invalidateQueries({ queryKey: KEYS.insight(date) });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.journal.remove(date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}
