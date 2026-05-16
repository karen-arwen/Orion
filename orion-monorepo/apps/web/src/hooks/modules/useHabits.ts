import { useCallback, useEffect, useState } from "react";
import type { HabitCreateInput, HabitSummary } from "@orion/types";
import { api, ApiClientError } from "../../lib/api.js";

interface UseHabitsState {
  summary: HabitSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: HabitCreateInput) => Promise<void>;
  toggle: (id: string, date?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Falha ao operar habitos.";
}

export function useHabits(): UseHabitsState {
  const [summary, setSummary] = useState<HabitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await api.habits.summary());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(
    async (input: HabitCreateInput) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.habits.create(input);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [refresh],
  );

  const toggle = useCallback(
    async (id: string, date?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await api.habits.toggle(id, date);
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
        await api.habits.remove(id);
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

  return { summary, isLoading, error, refresh, create, toggle, remove };
}
