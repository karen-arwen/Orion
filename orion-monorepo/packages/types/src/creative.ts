export type IdeaStatus = "ideia" | "rascunho" | "agendado" | "publicado" | "arquivado";

export interface ContentIdea {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  niche: string;
  format: string;
  status: IdeaStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IdeaCreateInput {
  title: string;
  body?: string;
  niche?: string;
  format?: string;
  status?: IdeaStatus;
  scheduledAt?: string;
  tags?: string[];
}
