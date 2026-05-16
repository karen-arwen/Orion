import { useCallback, useEffect, useState } from "react";
import type { FocusSessionInput, FocusSummary } from "@orion/types";
import { api, ApiClientError } from "../../lib/api.js";

interface UseFocusState {
  summary: FocusSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  start: (input: FocusSessionInput) => Promise<void>;
  complete: (id: string) => Promise<void>;
  interrupt: (id: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Falha ao operar modulo de foco.";
}

export function useFocus(): UseFocusState {
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await api.focus.summary());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const start = useCallback(
    async (input: FocusSessionInput) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.focus.start(input);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh],
  );

  const complete = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.focus.complete(id);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh],
  );

  const interrupt = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.focus.interrupt(id);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, isLoading, error, refresh, start, complete, interrupt };
}
