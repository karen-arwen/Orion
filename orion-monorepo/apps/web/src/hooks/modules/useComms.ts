import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useCommsInbox(): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.comms.inbox>>>> {
  return useQuery({
    queryKey: ["comms", "inbox"],
    queryFn: () => api.comms.inbox(),
    staleTime: 60_000,
  });
}

export function useCommsSummary(enabled: boolean): ReturnType<
  typeof useQuery<Awaited<ReturnType<typeof api.comms.summary>>>
> {
  return useQuery({
    queryKey: ["comms", "summary"],
    queryFn: () => api.comms.summary(),
    enabled,
    staleTime: 5 * 60_000,
  });
}
