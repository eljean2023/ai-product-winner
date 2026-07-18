// Marketplace layer — the Unified Product Data Layer. This module knows how
// to talk to real marketplaces; the AI intelligence engine (src/lib/engine)
// never imports a specific provider, only the generic ProductListing type
// and `searchAllMarketplaces`/`searchAllMarketplaces` from ./registry.
// Adding a new marketplace means implementing MarketplaceProvider and
// registering it in registry.ts; nothing else in the app changes — SerpAPI,
// Amazon PA-API, Mercado Libre, eBay, Keepa, Walmart are all just
// interchangeable implementations of the same interface, never a hardcoded
// dependency of the scoring engine.

// The single normalized shape every provider maps its raw data into. `seller`
// and `condition` are kept beyond the marketplace's own product-identity
// fields because they're real scoring inputs downstream (trust/return-risk,
// margin), not because every provider populates them.
export interface ProductListing {
  id: string;
  title: string;
  marketplace: MarketplaceId;
  url: string;
  image?: string;
  price: number;
  currency: string;
  category?: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  condition?: string;
  sellerCount?: number;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  shippingInfo?: {
    freeShipping?: boolean;
    location?: string;
  };
  // The provider's own pre-normalization payload for this listing, kept for
  // future debugging/enrichment (e.g. cross-referencing with Keepa by ASIN).
  // Never read by the scoring engine.
  rawData?: unknown;
}

export type MarketplaceId = "amazon" | "ebay" | "mercadolibre" | "walmart";

// Identifies the data source/vendor behind a provider, distinct from
// `MarketplaceId` (which storefront the data represents). This split exists
// because more than one provider can serve the same marketplace — e.g.
// Amazon data comes from the direct PA-API; SerpAPI is implemented as an
// alternate vendor but is disabled (see marketplace/registry.ts).
export type ProviderId =
  | "serpapi-amazon"
  | "serpapi-ebay"
  | "mercadolibre"
  | "amazon-paapi"
  | "ebay-direct"
  | "walmart"
  | "keepa";

// Every field beyond `available`/`marketplace`/`query`/`listingCount` is
// optional on purpose: if real data can't be retrieved, the field is simply
// omitted. Never invent a marketplace value.
export interface MarketplaceSummary {
  marketplace: MarketplaceId;
  marketplaceName: string;
  available: boolean;
  reason?: string;
  query: string;
  listingCount: number;
  averagePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  sellerCount?: number;
  averageRating?: number;
  totalReviews?: number;
  topListing?: ProductListing;
  listings: ProductListing[];
}

export interface MarketplaceSearchOptions {
  country?: string;
  limit?: number;
}

// Whether a provider is currently reachable/authorized. Returned by
// `getProviderStatus()` instead of doing a search, so the app can surface
// connection state (e.g. /api/marketplace/status) without hitting the
// network. `connected: false` must always carry a `reason` — see the "no
// fake data" rule: an unavailable provider reports why, it never fabricates
// results.
export interface ProviderStatus {
  connected: boolean;
  reason?: string;
  // Whether the provider has the credentials it needs to function at all
  // (env vars present), independent of `connected`. A provider can be
  // configured but not connected (e.g. Mercado Libre's OAuth handshake
  // hasn't been completed yet) — that must read as "Not connected", never
  // "Not configured", since the latter tells the operator to go check env
  // vars that are actually fine. Optional because not every ProviderStatus
  // producer distinguishes the two (e.g. Keepa, where configured === connected).
  configured?: boolean;
}

// Shared by every provider family (marketplace search today, historical
// intelligence like Keepa in the future) so status introspection is uniform
// even though their data methods differ.
export interface Provider {
  id: string;
  name: string;
  getProviderStatus(): Promise<ProviderStatus>;
}

export interface MarketplaceProvider extends Provider {
  id: ProviderId;
  // Which storefront this provider's data represents — see `ProviderId`.
  marketplace: MarketplaceId;
  isConfigured(): boolean;
  searchProducts(query: string, opts?: MarketplaceSearchOptions): Promise<MarketplaceSummary>;
  // Optional: most providers are search-only for now. A provider can add
  // single-product lookup later without any other part of the app changing.
  getProductDetails?(id: string, opts?: MarketplaceSearchOptions): Promise<ProductListing | null>;
}

// A point-in-time historical data snapshot for one already-known item (e.g.
// Keepa's price/sales-rank history for an ASIN). Deliberately not a
// MarketplaceProvider: these providers are keyed by product id, not a search
// query — they enrich a listing the app already found, they never discover
// new ones, so they're never registered in registry.ts's marketplaceProviders
// array or included in searchAllMarketplaces.
export interface ProductHistoryPoint {
  timestamp: string;
  price?: number;
  salesRank?: number;
}

export interface ProductHistory {
  id: string;
  marketplace: MarketplaceId;
  points: ProductHistoryPoint[];
}

export interface HistoricalIntelligenceProvider extends Provider {
  getProductHistory(id: string): Promise<ProductHistory | null>;
}

export function unavailableSummary(
  marketplace: MarketplaceId,
  marketplaceName: string,
  query: string,
  reason: string
): MarketplaceSummary {
  return {
    marketplace,
    marketplaceName,
    available: false,
    reason,
    query,
    listingCount: 0,
    listings: [],
  };
}
