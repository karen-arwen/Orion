import { useEffect } from "react";
import { useAlertsStore } from "../stores/alerts.store.js";

export function useAlerts(): ReturnType<typeof useAlertsStore> {
  const store = useAlertsStore();
  useEffect(() => {
    void store.fetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return store;
}
