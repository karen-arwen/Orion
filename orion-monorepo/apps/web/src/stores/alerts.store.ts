import { create } from "zustand";
import type { AlertScanResult, ProactiveAlert } from "@orion/types";
import { api } from "../lib/api.js";

interface AlertsStore {
  alerts: ProactiveAlert[];
  fetch: () => Promise<void>;
  scan: () => Promise<AlertScanResult | null>;
  approve: (alert: ProactiveAlert) => void;
  dismiss: (alert: ProactiveAlert) => void;
}

export const useAlertsStore = create<AlertsStore>((set, get) => ({
  alerts: [],

  fetch: async () => {
    try {
      const list = await api.listAlerts();
      set({ alerts: list });
    } catch {
      // Sem backend / sem auth — segue silencioso
    }
  },

  scan: async () => {
    try {
      const result = await api.scanAlerts();
      const list = await api.listAlerts();
      set({ alerts: list });
      return result;
    } catch {
      return null;
    }
  },

  approve: (alert) => {
    set({ alerts: get().alerts.filter((a) => a.id !== alert.id) });
    void api.approveAlert(alert.id).catch(() => undefined);
  },

  dismiss: (alert) => {
    set({ alerts: get().alerts.filter((a) => a.id !== alert.id) });
    void api.dismissAlert(alert.id).catch(() => undefined);
  },
}));
