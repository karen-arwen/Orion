import { useCallback, useEffect, useState } from "react";
import type { SleepLogInput, SleepSummary } from "@orion/types";
import { api, ApiClientError } from "../../lib/api.js";

interface UseSleepState {
  summary: SleepSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: SleepLogInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Falha ao operar sleep coach.";
}

export function useSleep(): UseSleepState {
  const [summary, setSummary] = useState<SleepSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await api.sleep.summary());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(
    async (input: SleepLogInput) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.sleep.create(input);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.sleep.remove(id);
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

  return { summary, isLoading, error, refresh, create, remove };
}
