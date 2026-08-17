import { useMutation } from "@tanstack/react-query";
import type { LanguagePracticeInput, LanguagePracticeResult } from "@orion/types";
import { api } from "../../lib/api.js";

export function useLanguagePractice(): ReturnType<
  typeof useMutation<LanguagePracticeResult, Error, LanguagePracticeInput>
> {
  return useMutation({
    mutationFn: (input) => api.language.practice(input),
  });
}
