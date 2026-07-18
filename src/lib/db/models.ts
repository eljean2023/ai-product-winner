import type { MarketplaceId } from "@/lib/marketplace/types";

// Persistence-layer prep only — no database client, ORM, or auth exists yet.
// These are plain interfaces describing the future shape of stored data
// (price history, trend analysis, saved products); nothing in the app reads
// or writes them today. When a real persistence layer is added, it should
// implement these shapes rather than inventing new ones.

// One point-in-time record of a product's price and score, keyed by
// marketplace — the basis for future price-history charts and score-drift
// tracking.
export interface ProductSnapshot {
  productId: string;
  marketplace: MarketplaceId;
  price: number;
  score: number;
  timestamp: string;
}

// One point-in-time demand reading for a search keyword on a given
// marketplace — the basis for future trend/seasonality analysis.
export interface MarketTrend {
  keyword: string;
  marketplace: MarketplaceId;
  demandScore: number;
  timestamp: string;
}
