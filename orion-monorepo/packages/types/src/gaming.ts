export type GameStatus = "want" | "playing" | "beaten" | "dropped";

export interface GameEntry {
  id: string;
  userId: string;
  title: string;
  platform: string;
  status: GameStatus;
  genre: string | null;
  hoursPlayed: number;
  rating: number | null;
  dealActive: boolean;
  dealPrice: number | null;
  coverUrl: string | null;
  rawgId: number | null;
  addedAt: string;
  updatedAt: string;
}

export interface GameEntryInput {
  title: string;
  platform: string;
  status?: GameStatus;
  genre?: string;
  hoursPlayed?: number;
  rating?: number;
  coverUrl?: string;
  rawgId?: number;
}

export interface GameEntryUpdateInput {
  title?: string;
  platform?: string;
  status?: GameStatus;
  genre?: string | null;
  hoursPlayed?: number;
  rating?: number | null;
  dealActive?: boolean;
  dealPrice?: number | null;
  coverUrl?: string | null;
}

export interface GameCatalogItem {
  rawgId: number;
  title: string;
  released: string;
  rating: number;
  metacritic: number | null;
  coverUrl: string | null;
  platforms: string[];
  genres: string[];
}

export interface GameRecommendation {
  title: string;
  reason: string;
  platform: string;
  genre: string | null;
  fitScore: number;
  source: "library" | "catalog";
}

export interface GameShelfSummary {
  games: GameEntry[];
  recommendations: GameRecommendation[];
  dealWatch: GameEntry[];
}
