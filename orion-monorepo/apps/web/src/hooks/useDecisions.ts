import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DecisionApproveResult, DecisionItem, DecisionQueueSummary } from "@orion/types";
import { api } from "../lib/api.js";

export function useDecisions(): ReturnType<typeof useQuery<DecisionItem[]>> {
  return useQuery({
    queryKey: ["decisions"],
    queryFn: () => api.listDecisions(),
    staleTime: 30_000,
  });
}

export function useExecutedDecisions(): ReturnType<typeof useQuery<DecisionItem[]>> {
  return useQuery({
    queryKey: ["decisions", "executed"],
    queryFn: () => api.listDecisions("executed"),
    staleTime: 20_000,
  });
}

export function useDecisionQueueSummary(): ReturnType<typeof useQuery<DecisionQueueSummary>> {
  return useQuery({
    queryKey: ["decisions", "queue-summary"],
    queryFn: () => api.getDecisionQueueSummary(),
    staleTime: 20_000,
  });
}

export function useSyncDecisions(): ReturnType<typeof useMutation<{ created: number; pending: number }, Error, void>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncDecisionsFromAlerts(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decisions"] });
      void qc.invalidateQueries({ queryKey: ["decisions", "executed"] });
      void qc.invalidateQueries({ queryKey: ["decisions", "queue-summary"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}

export function useApproveDecision(): ReturnType<typeof useMutation<DecisionApproveResult, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.approveDecision(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decisions"] });
      void qc.invalidateQueries({ queryKey: ["decisions", "executed"] });
      void qc.invalidateQueries({ queryKey: ["decisions", "queue-summary"] });
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
      void qc.invalidateQueries({ queryKey: ["memories"] });
      void qc.invalidateQueries({ queryKey: ["life"] });
      void qc.invalidateQueries({ queryKey: ["social"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["finance"] });
      void qc.invalidateQueries({ queryKey: ["media"] });
      void qc.invalidateQueries({ queryKey: ["shop"] });
      void qc.invalidateQueries({ queryKey: ["security"] });
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useDismissDecision(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.dismissDecision(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decisions"] });
      void qc.invalidateQueries({ queryKey: ["decisions", "executed"] });
      void qc.invalidateQueries({ queryKey: ["decisions", "queue-summary"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}
