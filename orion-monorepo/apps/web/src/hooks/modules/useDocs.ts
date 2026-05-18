import { useMutation, useQuery } from "@tanstack/react-query";
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
