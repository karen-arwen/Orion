import { useMutation } from "@tanstack/react-query";
import type { MindsetCheckinInput, MindsetCheckinResult } from "@orion/types";
import { api } from "../../lib/api.js";

export function useMindsetCheckin() {
  return useMutation<MindsetCheckinResult, Error, MindsetCheckinInput>({
    mutationFn: (input) => api.mindset.checkin(input),
  });
}
