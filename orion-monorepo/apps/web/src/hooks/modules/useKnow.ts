import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LessonLevel, LessonSession, LessonSessionSummary } from "@orion/types";
import { api } from "../../lib/api.js";

type AskInput = { question: string; depth?: "rapido" | "padrao" | "fundo"; context?: string };
type AskResult = { kind: "answer"; answer: string } | { kind: "lesson"; lesson: LessonSession };

export function useAskTutor(): ReturnType<typeof useMutation<AskResult, Error, AskInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AskInput) => api.know.ask(input),
    onSuccess: (data) => {
      if (data.kind === "lesson") {
        void qc.invalidateQueries({ queryKey: ["know", "lessons"] });
      }
    },
  });
}

export function useLessons(): ReturnType<typeof useQuery<LessonSessionSummary[]>> {
  return useQuery({
    queryKey: ["know", "lessons"],
    queryFn: () => api.know.listLessons(),
    staleTime: 30_000,
  });
}

export function useLesson(
  id: string | null,
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.know.getLesson>>>> {
  return useQuery({
    queryKey: ["know", "lessons", id],
    queryFn: () => api.know.getLesson(id ?? ""),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateLesson(): ReturnType<
  typeof useMutation<LessonSession, Error, { topic: string; level?: LessonLevel }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { topic: string; level?: LessonLevel }) => api.know.createLesson(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["know", "lessons"] });
    },
  });
}

export function useContinueLesson(): ReturnType<
  typeof useMutation<{ answer: string }, Error, { id: string; question: string }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, question }: { id: string; question: string }) =>
      api.know.continueLesson(id, question),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["know", "lessons", id] });
    },
  });
}

export function useDeleteLesson(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.know.deleteLesson(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["know", "lessons"] });
    },
  });
}
