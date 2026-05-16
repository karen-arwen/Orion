import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

type CoachInput = {
  prompt: string;
  mode?: "portfolio" | "entrevista" | "plano_90" | "review" | "livre";
};

export function useCareerCoach(): ReturnType<
  typeof useMutation<{ answer: string }, Error, CoachInput>
> {
  return useMutation({
    mutationFn: (input: CoachInput) => api.career.coach(input),
  });
}
