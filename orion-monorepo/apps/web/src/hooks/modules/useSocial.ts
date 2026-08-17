import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SocialContact, SocialContactInput, SocialNudge } from "@orion/types";
import { api } from "../../lib/api.js";

export function useSocialContacts() {
  return useQuery<SocialContact[]>({
    queryKey: ["social", "contacts"],
    queryFn: api.social.contacts,
  });
}

export function useSocialNudges() {
  return useQuery<SocialNudge[]>({
    queryKey: ["social", "nudges"],
    queryFn: api.social.nudges,
  });
}

export function useCreateSocialContact() {
  const qc = useQueryClient();
  return useMutation<SocialContact, Error, SocialContactInput>({
    mutationFn: (input) => api.social.createContact(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["social"] });
    },
  });
}
