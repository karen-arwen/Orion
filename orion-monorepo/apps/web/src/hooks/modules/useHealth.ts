import { useCallback, useEffect, useState } from "react";
import type { EnergyLogInput, EnergySummary } from "@orion/types";
import { api } from "../../lib/api.js";

interface HealthState {
  summary: EnergySummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logEnergy: (input: EnergyLogInput) => Promise<void>;
}

export function useHealth(): HealthState {
  const [summary, setSummary] = useState<EnergySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await api.health.energy());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar saude.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logEnergy = useCallback(async (input: EnergyLogInput) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.health.logEnergy(input);
      setSummary(await api.health.energy());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar energia.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, isLoading, error, refresh, logEnergy };
}
