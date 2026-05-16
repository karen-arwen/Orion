import { useCallback, useEffect, useState } from "react";
import type { ContentIdea, ContentIdeaGenerateInput, ContentIdeaInput, ContentIdeaStatusInput } from "@orion/types";
import { api, ApiClientError } from "../../lib/api.js";

interface UseCreativeState {
  ideas: ContentIdea[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: ContentIdeaInput) => Promise<void>;
  generate: (input: ContentIdeaGenerateInput) => Promise<void>;
  updateStatus: (id: string, input: ContentIdeaStatusInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Falha ao operar modulo de criacao.";
}

export function useCreative(): UseCreativeState {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setIdeas(await api.creative.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runAndRefresh = useCallback(
    async (operation: () => Promise<unknown>) => {
      setIsLoading(true);
      setError(null);
      try {
        await operation();
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh],
  );

  const create = useCallback((input: ContentIdeaInput) => runAndRefresh(() => api.creative.create(input)), [runAndRefresh]);
  const generate = useCallback((input: ContentIdeaGenerateInput) => runAndRefresh(() => api.creative.generate(input)), [runAndRefresh]);
  const updateStatus = useCallback((id: string, input: ContentIdeaStatusInput) => runAndRefresh(() => api.creative.updateStatus(id, input)), [runAndRefresh]);
  const remove = useCallback((id: string) => runAndRefresh(() => api.creative.remove(id)), [runAndRefresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ideas, isLoading, error, refresh, create, generate, updateStatus, remove };
}
