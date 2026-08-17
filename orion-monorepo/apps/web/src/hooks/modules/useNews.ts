import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobRadarInput, JobRadarResult, NewsItem, NewsSearchResult } from "@orion/types";
import { api } from "../../lib/api.js";

export function useSavedNews(): ReturnType<typeof useQuery<NewsItem[]>> {
  return useQuery({
    queryKey: ["news", "saved"],
    queryFn: () => api.news.saved() as Promise<NewsItem[]>,
    staleTime: 60_000,
  });
}

export function useSearchNews(): ReturnType<
  typeof useMutation<NewsSearchResult[], Error, { query: string; freshness?: "pd" | "pw" | "pm" }>
> {
  return useMutation({
    mutationFn: ({ query, freshness }) => api.news.search(query, freshness ?? "pw"),
  });
}

export function useJobRadar(): ReturnType<typeof useMutation<JobRadarResult[], Error, JobRadarInput>> {
  return useMutation({
    mutationFn: (input: JobRadarInput) => api.news.jobs(input),
  });
}

export function useSaveNews(): ReturnType<
  typeof useMutation<
    NewsItem,
    Error,
    { title: string; url: string; summary?: string; source?: string; category?: string }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item) => api.news.save(item),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["news"] });
    },
  });
}

export function useRemoveNews(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.news.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["news"] });
    },
  });
}
