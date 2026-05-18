export type GameStatus = "wishlist" | "playing" | "finished" | "dropped" | "paused";

export interface GameEntry {
  id: string;
  userId: string;
  title: string;
  rawgId: number | null;
  platform: string | null;
  genre: string | null;
  status: GameStatus;
  hoursPlayed: number;
  rating: number | null;
  notes: string | null;
  coverUrl: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameCreateInput {
  title: string;
  rawgId?: number;
  platform?: string;
  genre?: string;
  status?: GameStatus;
  coverUrl?: string;
  releasedAt?: string;
}
