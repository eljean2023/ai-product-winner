import type { MarketplaceId, MarketplaceSummary, ProductListing } from "./types";

// Shared by every marketplace provider's `searchProducts`. The aggregate math
// (average/min/max price, average rating, total reviews, distinct seller
// count) is identical across providers; only how raw items become
// ProductListing[] and what currency they're priced in differs. Aggregates
// are always computed over the *full* `listings` array — `opts.limit` only
// truncates the returned `listings` field, never the numbers derived from it.
//
// Precondition: `listings` must be non-empty. Callers already check this
// themselves (a zero-listing search returns `unavailableSummary(...)`
// instead), so it isn't re-validated here.
export interface BuildSummaryOptions {
  currency: string;
  limit?: number;
}

export function buildMarketplaceSummary(
  marketplace: MarketplaceId,
  marketplaceName: string,
  query: string,
  listings: ProductListing[],
  opts: BuildSummaryOptions
): MarketplaceSummary {
  const prices = listings.map((l) => l.price);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  const ratings = listings.map((l) => l.rating).filter((r): r is number => typeof r === "number");
  const reviewCounts = listings.map((l) => l.reviewCount).filter((r): r is number => typeof r === "number");
  const sellers = new Set(listings.map((l) => l.seller).filter((s): s is string => Boolean(s)));

  return {
    marketplace,
    marketplaceName,
    available: true,
    query,
    listingCount: listings.length,
    averagePrice: Math.round(averagePrice * 100) / 100,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    currency: opts.currency,
    sellerCount: sellers.size || undefined,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
      : undefined,
    totalReviews: reviewCounts.length ? reviewCounts.reduce((s, r) => s + r, 0) : undefined,
    topListing: listings[0],
    listings: opts.limit !== undefined ? listings.slice(0, opts.limit) : listings,
  };
}
