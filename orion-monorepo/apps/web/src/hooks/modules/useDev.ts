import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  DevCommandProposal,
  DevCommandProposalInput,
  DevCodeContextMap,
  DevDebugRunbook,
  DevExecutionDiagnosis,
  DevFilePreview,
  DevPatchProposal,
  DevPatchProposalInput,
  DevWorkspaceSummary,
} from "@orion/types";
import { api } from "../../lib/api.js";

export function useDevWorkspace(): ReturnType<typeof useQuery<DevWorkspaceSummary>> {
  return useQuery({
    queryKey: ["dev", "workspace"],
    queryFn: () => api.dev.workspace(),
    staleTime: 30_000,
  });
}

export function useDevContextMap(): ReturnType<typeof useQuery<DevCodeContextMap>> {
  return useQuery({
    queryKey: ["dev", "context-map"],
    queryFn: () => api.dev.contextMap(),
    staleTime: 30_000,
  });
}

export function useDevFile(path: string): ReturnType<typeof useQuery<DevFilePreview>> {
  return useQuery({
    queryKey: ["dev", "file", path],
    queryFn: () => api.dev.file(path),
    enabled: path.trim().length > 0,
    staleTime: 15_000,
  });
}

export function useDevProposal(): ReturnType<typeof useMutation<DevPatchProposal, Error, DevPatchProposalInput>> {
  return useMutation({
    mutationFn: (input) => api.dev.proposal(input),
  });
}

export function useDevCommand(): ReturnType<typeof useMutation<DevCommandProposal, Error, DevCommandProposalInput>> {
  return useMutation({
    mutationFn: (input) => api.dev.command(input),
  });
}

export function useDevDiagnosis(): ReturnType<typeof useQuery<DevExecutionDiagnosis>> {
  return useQuery({
    queryKey: ["dev", "diagnosis"],
    queryFn: () => api.dev.diagnose(),
    staleTime: 10_000,
  });
}

export function useDevRunbook(): ReturnType<typeof useQuery<DevDebugRunbook>> {
  return useQuery({
    queryKey: ["dev", "runbook"],
    queryFn: () => api.dev.runbook(),
    staleTime: 10_000,
  });
}
