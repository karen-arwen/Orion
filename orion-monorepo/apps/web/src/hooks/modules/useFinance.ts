import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FinanceGoal,
  FinanceGoalInput,
  FinanceSubscription,
  FinanceSubscriptionInput,
  FinanceSummary,
  FinanceTransaction,
  FinanceTransactionInput,
} from "@orion/types";
import { api } from "../../lib/api.js";

export function useFinanceSummary() {
  return useQuery<FinanceSummary>({
    queryKey: ["finance", "summary"],
    queryFn: api.finance.summary,
  });
}

export function useCreateFinanceTransaction() {
  const qc = useQueryClient();
  return useMutation<FinanceTransaction, Error, FinanceTransactionInput>({
    mutationFn: api.finance.createTransaction,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useCreateFinanceSubscription() {
  const qc = useQueryClient();
  return useMutation<FinanceSubscription, Error, FinanceSubscriptionInput>({
    mutationFn: api.finance.createSubscription,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useCreateFinanceGoal() {
  const qc = useQueryClient();
  return useMutation<FinanceGoal, Error, FinanceGoalInput>({
    mutationFn: api.finance.createGoal,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useUpdateFinanceGoal() {
  const qc = useQueryClient();
  return useMutation<FinanceGoal, Error, { id: string; input: Partial<FinanceGoalInput> }>({
    mutationFn: ({ id, input }) => api.finance.updateGoal(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

import type { FinanceMonthData } from "@orion/types";

export function useFinanceMonthData(month: string) {
  return useQuery<FinanceMonthData>({
    queryKey: ["finance", "month", month],
    queryFn: () => api.finance.monthData(month),
    staleTime: 60_000,
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { month: string; category: string; amount: number }) =>
      api.finance.upsertBudget(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, category }: { month: string; category: string }) =>
      api.finance.deleteBudget(month, category),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.finance.importCsv(csv),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}
