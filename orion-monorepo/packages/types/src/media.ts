import type { PreferenceLayer } from "./user.js";

export type MediaKind = "movie" | "series" | "anime" | "documentary" | "book" | "manga" | "other";
export type MediaStatus = "wishlist" | "watching" | "finished" | "dropped" | "paused";

export interface MediaItem {
  id: string;
  title: string;
  kind: MediaKind;
  status: MediaStatus;
  genres: string[];
  mood: string;
  platform: string;
  releaseYear: number | null;
  rating: number | null;
  notes: string;
  coverUrl: string | null;
  tasteLayer: PreferenceLayer;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItemInput {
  title: string;
  kind?: MediaKind;
  status?: MediaStatus;
  genres?: string[];
  mood?: string;
  platform?: string;
  releaseYear?: number | null;
  rating?: number | null;
  notes?: string;
  coverUrl?: string | null;
  tasteLayer?: PreferenceLayer;
}

export interface MediaTasteProfile {
  total: number;
  watchlist: number;
  finished: number;
  avgRating: number | null;
  topGenres: Array<{ name: string; count: number }>;
  topMoods: Array<{ name: string; count: number }>;
  layers: Record<PreferenceLayer, number>;
}

export interface MediaRecommendationInput {
  mood?: string;
  availableTime?: number;
  intent?: "current" | "nostalgia" | "exploration" | "balanced";
  includeAnime?: boolean;
}

export interface MediaRecommendation {
  title: string;
  kind: MediaKind;
  genres: string[];
  mood: string;
  reason: string;
  fitScore: number;
  layer: PreferenceLayer;
}

export interface MediaHub {
  items: MediaItem[];
  taste: MediaTasteProfile;
  recommendations: MediaRecommendation[];
}
