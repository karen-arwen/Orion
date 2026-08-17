import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ClassifiedEmail } from "../../lib/api.js";

type Filter = "all" | "unread" | "starred";

export function useCommsInbox(filter: Filter = "all") {
  return useQuery({
    queryKey: ["comms", "inbox", filter],
    queryFn: () => api.comms.inbox(filter),
    staleTime: 60_000,
  });
}

export function useCommsSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["comms", "summary"],
    queryFn: () => api.comms.summary(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useReadEmail(id: string | null) {
  return useQuery({
    queryKey: ["comms", "email", id],
    queryFn: () => api.comms.readEmail(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useDraftReply() {
  return useMutation({
    mutationFn: ({ id, instructions }: { id: string; instructions?: string }) =>
      api.comms.draftReply(id, instructions),
  });
}

export function useSendReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { threadId: string; to: string; subject: string; body: string };
    }) => api.comms.sendReply(id, payload),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comms", "inbox"] }); },
  });
}

export function useArchiveEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.comms.archive(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comms", "inbox"] }); },
  });
}

export function useSnoozeEmail() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { subject: string; from: string; snoozeUntil: string };
    }) => api.comms.snooze(id, payload),
  });
}

export function useCreateTaskFromEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: { customTitle?: string; dueAt?: string };
    }) => api.comms.createTask(id, payload),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["life"] }); },
  });
}
