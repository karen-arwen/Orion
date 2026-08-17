import { useMutation } from "@tanstack/react-query";
import type { WhatIfScenario, WhatIfScenarioInput } from "@orion/types";
import { api } from "../../lib/api.js";

export function useWhatIfScenario() {
  return useMutation<WhatIfScenario, Error, WhatIfScenarioInput>({
    mutationFn: (input) => api.whatif.scenario(input),
  });
}
