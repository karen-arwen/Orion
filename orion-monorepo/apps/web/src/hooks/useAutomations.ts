import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Automation, AutomationOverview, AutonomyCore, AutonomyPolicy, AutonomyPolicyInput } from "@orion/types";
import { api } from "../lib/api.js";

export function useAutomations(): ReturnType<typeof useQuery<Automation[]>> {
  return useQuery({
    queryKey: ["automations"],
    queryFn: () => api.listAutomations(),
    staleTime: 60_000,
  });
}

export function useAutomationOverview(): ReturnType<typeof useQuery<AutomationOverview>> {
  return useQuery({
    queryKey: ["automations", "overview"],
    queryFn: () => api.getAutomationOverview(),
    staleTime: 30_000,
  });
}

export function useAutonomyCore(): ReturnType<typeof useQuery<AutonomyCore>> {
  return useQuery({
    queryKey: ["automations", "autonomy-core"],
    queryFn: () => api.getAutonomyCore(),
    staleTime: 30_000,
  });
}

export function useUpdateAutonomyPolicy(): ReturnType<
  typeof useMutation<AutonomyPolicy, Error, { moduleId: string; input: AutonomyPolicyInput }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, input }) => api.updateAutonomyPolicy(moduleId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automations", "autonomy-core"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}

export function useToggleAutomation(): ReturnType<
  typeof useMutation<Automation, Error, { id: string; enabled: boolean }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }) => api.updateAutomation(id, { enabled }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automations"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}

export function useTriggerAutomation(): ReturnType<
  typeof useMutation<{ logId: string; status: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.triggerAutomation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["automations"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}

export function useSeedDefaultAutomations(): ReturnType<
  typeof useMutation<Automation[], Error, void>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.seedDefaultAutomations(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automations"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}

export function useDeleteAutomation(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automations"] });
      void qc.invalidateQueries({ queryKey: ["automations", "overview"] });
    },
  });
}
