export interface NewsItem {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  category: string;
  read: boolean;
  saved: boolean;
  createdAt: string;
}

export interface NewsSearchResult {
  title: string;
  url: string;
  description: string;
  age: string | null;
}

export type JobSeniority = "junior" | "pleno" | "senior" | "lead" | "any";
export type JobModality = "remote" | "hybrid" | "onsite" | "any";

export interface JobRadarInput {
  role: string;
  stack: string[];
  seniority: JobSeniority;
  modality: JobModality;
  location: string;
  includeInternational?: boolean;
  excludeTerms?: string[];
}

export interface JobRadarResult extends NewsSearchResult {
  source: string;
  fitScore: number;
  signals: string[];
}
