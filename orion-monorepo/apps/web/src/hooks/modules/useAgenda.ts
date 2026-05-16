import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useAgendaToday(): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.agenda.today>>>> {
  return useQuery({
    queryKey: ["agenda", "today"],
    queryFn: () => api.agenda.today(),
    staleTime: 60_000,
  });
}

export function useAgendaWeek(): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.agenda.week>>>> {
  return useQuery({
    queryKey: ["agenda", "week"],
    queryFn: () => api.agenda.week(),
    staleTime: 60_000,
  });
}

export function useAgendaFocusSuggestion(
  enabled: boolean,
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.agenda.focusSuggestion>>>> {
  return useQuery({
    queryKey: ["agenda", "focus"],
    queryFn: () => api.agenda.focusSuggestion(),
    enabled,
    staleTime: 5 * 60_000,
  });
}
