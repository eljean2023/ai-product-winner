// Marketplace layer. This module knows how to talk to real marketplaces —
// the AI engine never imports these providers directly, only the generic
// `searchAllMarketplaces` from ./registry. Adding a new marketplace means
// implementing MarketplaceProvider and registering it; nothing else changes.

export interface MarketplaceListing {
  title: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  condition?: string;
  category?: string;
  freeShipping?: boolean;
  location?: string;
}

export type MarketplaceId = "mercadolibre" | "amazon";

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
  topListing?: MarketplaceListing;
  listings: MarketplaceListing[];
}

export interface MarketplaceSearchOptions {
  country?: string;
  limit?: number;
}

export interface MarketplaceProvider {
  id: MarketplaceId;
  name: string;
  isConfigured(): boolean;
  search(query: string, opts?: MarketplaceSearchOptions): Promise<MarketplaceSummary>;
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
