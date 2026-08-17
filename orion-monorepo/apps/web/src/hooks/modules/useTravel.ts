import { useMutation } from "@tanstack/react-query";
import type { TravelPlan, TravelPlanInput } from "@orion/types";
import { api } from "../../lib/api.js";

export function useTravelPlan(): ReturnType<typeof useMutation<TravelPlan, Error, TravelPlanInput>> {
  return useMutation({
    mutationFn: (input) => api.travel.plan(input),
  });
}
