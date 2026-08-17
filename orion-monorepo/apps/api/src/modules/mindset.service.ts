import type { MindsetCheckinInput, MindsetCheckinResult } from "@orion/types";
import { prisma } from "../db/prisma.js";

type MindsetPattern = "stress_alto" | "baixa_energia" | "alta_tracao" | "neutro";

function classify(input: MindsetCheckinInput): MindsetPattern {
  if (input.stress >= 8) return "stress_alto";
  if (input.energy <= 3 && input.mood <= 4) return "baixa_energia";
  if (input.mood >= 7 && input.energy >= 7) return "alta_tracao";
  return "neutro";
}

export async function createMindsetCheckin(userId: string, input: MindsetCheckinInput): Promise<MindsetCheckinResult> {
  const pattern = classify(input);
  const note = input.note ? ` Nota: ${input.note}` : "";
  const map: Record<MindsetPattern, Omit<MindsetCheckinResult, "id" | "pattern">> = {
    stress_alto: {
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      intervention: "Reduzir carga agora: escolha uma unica tarefa pequena e adie decisoes grandes por algumas horas.",
      reframe: "Seu sistema esta sinalizando excesso, nao fracasso.",
      nextAction: "Faça um despejo mental de 3 minutos e marque uma pausa curta.",
      createdAt: new Date().toISOString(),
    },
    baixa_energia: {
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      intervention: "Troque ambicao por manutencao: foco em recuperar energia e concluir algo minimo.",
      reframe: "Baixa energia pede design de ambiente, nao forca bruta.",
      nextAction: "Escolha uma tarefa de ate 10 minutos ou registre descanso.",
      createdAt: new Date().toISOString(),
    },
    alta_tracao: {
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      intervention: "Use a janela boa para atacar trabalho profundo ou decisao importante.",
      reframe: "Esse e um sinal de tracao: proteja a proxima hora.",
      nextAction: "Bloqueie um foco de 45 minutos no que mais move o Orion.",
      createdAt: new Date().toISOString(),
    },
    neutro: {
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      intervention: "Mantenha cadencia: uma prioridade clara, um bloco de foco e uma pausa planejada.",
      reframe: "Estabilidade tambem e progresso.",
      nextAction: "Defina o proximo passo mensuravel do dia.",
      createdAt: new Date().toISOString(),
    },
  };
  const advice = map[pattern];
  const checkin = await prisma.mindsetCheckin.create({
    data: {
      userId,
      mood: input.mood,
      energy: input.energy,
      stress: input.stress,
      note: input.note,
      pattern,
      intervention: advice.intervention,
      reframe: advice.reframe,
      nextAction: advice.nextAction,
    },
  });
  await prisma.memory.create({
    data: {
      userId,
      type: "event",
      content: `Mindset check-in: humor ${input.mood}/10, energia ${input.energy}/10, stress ${input.stress}/10, padrao ${pattern}.${note}`,
      importance: pattern === "stress_alto" || pattern === "baixa_energia" ? 0.78 : 0.55,
      embedding: [],
    },
  });
  return {
    id: checkin.id,
    pattern: checkin.pattern,
    mood: checkin.mood,
    energy: checkin.energy,
    stress: checkin.stress,
    intervention: checkin.intervention,
    reframe: checkin.reframe,
    nextAction: checkin.nextAction,
    createdAt: checkin.createdAt.toISOString(),
  };
}
