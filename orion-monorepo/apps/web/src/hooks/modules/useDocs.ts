import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocAnalysis, DriveFileRow } from "@orion/types";
import { api } from "../../lib/api.js";

export function useAnalyzeDoc(): ReturnType<
  typeof useMutation<DocAnalysis, Error, { text: string; hint?: string }>
> {
  return useMutation({
    mutationFn: (input: { text: string; hint?: string }) => api.docs.analyze(input),
  });
}

export function useAnalyzeDriveDoc(): ReturnType<typeof useMutation<DocAnalysis, Error, string>> {
  return useMutation({
    mutationFn: (fileId: string) => api.docs.analyzeDrive(fileId),
  });
}

export function useRecentDriveFiles(
  query: string,
  enabled: boolean,
): ReturnType<typeof useQuery<DriveFileRow[]>> {
  return useQuery({
    queryKey: ["docs", "recent", query],
    queryFn: () => api.docs.recent(query),
    enabled,
    staleTime: 60_000,
  });
}

export function useUploadPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.docs.uploadPdf(file),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["docs", "history"] }); },
  });
}

export function useDocHistory(enabled = true) {
  return useQuery({
    queryKey: ["docs", "history"],
    queryFn: () => api.docs.history(30),
    enabled,
    staleTime: 30_000,
  });
}

export function useDeleteDocAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.docs.deleteHistory(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["docs", "history"] }); },
  });
}
