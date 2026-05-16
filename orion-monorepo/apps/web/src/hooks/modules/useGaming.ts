import { useCallback, useEffect, useState } from "react";
import type {
  GameCatalogItem,
  GameEntryInput,
  GameEntryUpdateInput,
  GameShelfSummary,
} from "@orion/types";
import { api, ApiClientError } from "../../lib/api.js";

interface UseGamingState {
  summary: GameShelfSummary;
  catalog: GameCatalogItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<void>;
  loadTrending: () => Promise<void>;
  create: (input: GameEntryInput) => Promise<void>;
  update: (id: string, input: GameEntryUpdateInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const emptySummary: GameShelfSummary = { games: [], recommendations: [], dealWatch: [] };

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Falha ao operar modulo gaming.";
}

export function useGaming(): UseGamingState {
  const [summary, setSummary] = useState<GameShelfSummary>(emptySummary);
  const [catalog, setCatalog] = useState<GameCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await api.gaming.summary());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      setCatalog(await api.gaming.search(query));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCatalog(await api.gaming.trending());
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

  const create = useCallback((input: GameEntryInput) => runAndRefresh(() => api.gaming.create(input)), [runAndRefresh]);
  const update = useCallback((id: string, input: GameEntryUpdateInput) => runAndRefresh(() => api.gaming.update(id, input)), [runAndRefresh]);
  const remove = useCallback((id: string) => runAndRefresh(() => api.gaming.remove(id)), [runAndRefresh]);

  useEffect(() => {
    void refresh();
    void loadTrending();
  }, [refresh, loadTrending]);

  return { summary, catalog, isLoading, error, refresh, search, loadTrending, create, update, remove };
}
