import type { ChatMessage } from "@orion/types";

export interface ChatActionCard {
  id: string;
  title: string;
  detail: string;
  command: string;
  tone: "primary" | "warn" | "system";
}

const MATCHERS: Array<{
  test: RegExp;
  card: Omit<ChatActionCard, "id">;
}> = [
  {
    test: /sono|dormi|sleep/i,
    card: {
      title: "Registrar sono",
      detail: "Salvar este padrao no Sleep Coach e procurar tendencia depois.",
      command: "Registre esse sono no modulo Sleep e me diga o impacto provavel na energia de hoje.",
      tone: "primary",
    },
  },
  {
    test: /tarefa|prioridade|planner|foco/i,
    card: {
      title: "Criar proxima acao",
      detail: "Converter a conversa em uma tarefa pequena e executavel.",
      command: "Transforme isso em uma tarefa no Life OS com prioridade, energia e proximo passo.",
      tone: "system",
    },
  },
  {
    test: /viagem|roteiro|travel/i,
    card: {
      title: "Abrir plano de viagem",
      detail: "Gerar roteiro estruturado com logistica e riscos.",
      command: "Abra o modulo Travel e transforme essa ideia em roteiro executavel.",
      tone: "primary",
    },
  },
  {
    test: /vaga|emprego|carreira|portfolio/i,
    card: {
      title: "Rastrear oportunidade",
      detail: "Refinar busca por fonte, senioridade e stack.",
      command: "Abra o Radar de vagas e monte uma busca precisa para essa oportunidade.",
      tone: "warn",
    },
  },
  {
    test: /estress|ansiedade|cansad|energia|humor/i,
    card: {
      title: "Check-in de estado",
      detail: "Registrar sinal emocional para o Orion aprender seu padrao.",
      command: "Abra o Mindset e registre um check-in a partir desse contexto.",
      tone: "primary",
    },
  },
];

export function getActionCards(msg: ChatMessage): ChatActionCard[] {
  if (msg.role !== "assistant" || msg.loading || !msg.content) return [];
  return MATCHERS
    .filter((m) => m.test.test(msg.content))
    .slice(0, 2)
    .map((m, index) => ({
      id: `${msg.id ?? "msg"}-${index}-${m.card.title}`,
      ...m.card,
    }));
}
