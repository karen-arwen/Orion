export interface ContentIdea {
  id: string;
  userId: string;
  title: string;
  body: string;
  niche: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentIdeaInput {
  title: string;
  body: string;
  niche: string;
  format: string;
  status?: string;
  scheduledAt?: string;
}

export interface ContentIdeaGenerateInput {
  niche: string;
  format?: string;
  theme?: string;
  count?: number;
}

export interface ContentIdeaStatusInput {
  status: "idea" | "draft" | "scheduled" | "published";
  scheduledAt?: string;
}
