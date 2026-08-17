export interface WishlistItem {
  id: string;
  userId: string;
  name: string;
  url: string;
  targetPrice: number | null;
  currentPrice: number | null;
  priceHistory: Array<{ price: number; at: string }>;
  alertAtPct: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  dropPct: number | null;
  shouldAlert: boolean;
}

export interface WishlistCreateInput {
  name: string;
  url: string;
  targetPrice?: number;
  currentPrice?: number;
  alertAtPct?: number;
  notes?: string;
}

export interface WishlistUpdateInput extends Partial<WishlistCreateInput> {
  id: string;
}
