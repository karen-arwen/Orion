import cron from "node-cron";
import { runMorningBriefAll } from "./morning-brief.js";
import { scheduleAllCronAutomations } from "./automation.service.js";
import { startAutomationWorkers } from "./queues.js";

/* ═══════════════════════════════════════════════════════════════════
   Scheduler central das automações do O.R.I.O.N.

   Inicializado uma vez no boot do servidor. Cada cron é robusto a
   falhas — uma execução com erro não derruba o agendador.

   Padrão cron: "minuto hora dia-mês mês dia-semana"
     "0 8 * * 1-5" = 8:00 de segunda a sexta
     "30 22 * * *" = 22:30 todo dia
═══════════════════════════════════════════════════════════════════ */

export function startScheduler(): void {
  startAutomationWorkers();
  void scheduleAllCronAutomations().catch((err) => {
    console.warn("[scheduler] falha ao registrar automações cron:", (err as Error).message);
  });

  // Morning Brief: 8:00 segunda-sexta (horário do servidor)
  cron.schedule(
    "0 8 * * 1-5",
    () => {
      console.log("[scheduler] disparando Morning Brief");
      void runMorningBriefAll().catch((err) => {
        console.error("[scheduler] Morning Brief erro:", err);
      });
    },
    { timezone: "America/Sao_Paulo" },
  );

  console.log("◉ Scheduler ativo · Morning Brief 8:00 seg-sex (BRT)");
}
