import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Automation } from "@orion/types";
import { api } from "../lib/api.js";

export function useAutomations(): ReturnType<typeof useQuery<Automation[]>> {
  return useQuery({
    queryKey: ["automations"],
    queryFn: () => api.listAutomations(),
    staleTime: 60_000,
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
    },
  });
}
