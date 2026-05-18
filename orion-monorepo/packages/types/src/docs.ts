// ── DOCS — Análise de documentos ────────────────────────────────────

export interface DocRisk {
  topic: string;
  level: "baixo" | "medio" | "alto";
  detail: string;
}

export interface DocAction {
  title: string;
  why: string;
  /** Quem é responsável (opcional) */
  owner?: string;
  deadline?: string;
}

export interface DocAnalysis {
  /** Resumo executivo em 3-5 linhas */
  summary: string;
  /** Pontos de risco identificados */
  risks: DocRisk[];
  /** Ações sugeridas */
  actions: DocAction[];
  /** Perguntas críticas que o usuário deveria responder antes de agir */
  questions: string[];
  /** Categoria detectada: contrato, relatório, email, código, outro */
  category: string;
  /** Tamanho aproximado em chars */
  inputLength: number;
}

export interface DriveFileRow {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}
