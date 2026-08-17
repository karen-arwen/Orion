import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SecurityAccount,
  SecurityAccountInput,
  SecurityFinding,
  SecurityFindingInput,
  SecurityPosture,
} from "@orion/types";
import { api } from "../../lib/api.js";

export function useSecurityPosture() {
  return useQuery<SecurityPosture>({
    queryKey: ["security", "posture"],
    queryFn: api.security.posture,
  });
}

export function useCreateSecurityAccount() {
  const qc = useQueryClient();
  return useMutation<SecurityAccount, Error, SecurityAccountInput>({
    mutationFn: api.security.createAccount,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security"] }),
  });
}

export function useUpdateSecurityAccount() {
  const qc = useQueryClient();
  return useMutation<SecurityAccount, Error, { id: string; input: Partial<SecurityAccountInput> }>({
    mutationFn: ({ id, input }) => api.security.updateAccount(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security"] }),
  });
}

export function useCreateSecurityFinding() {
  const qc = useQueryClient();
  return useMutation<SecurityFinding, Error, SecurityFindingInput>({
    mutationFn: api.security.createFinding,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security"] }),
  });
}

export function useResolveSecurityFinding() {
  const qc = useQueryClient();
  return useMutation<SecurityFinding, Error, string>({
    mutationFn: api.security.resolveFinding,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security"] }),
  });
}
