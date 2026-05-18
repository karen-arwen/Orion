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
