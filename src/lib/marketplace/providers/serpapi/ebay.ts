import type { MarketplaceListing, MarketplaceProvider, MarketplaceSummary } from "../../types";
import { unavailableSummary } from "../../types";
import { isSerpApiConfigured } from "./config";
import { fetchSerpApi } from "./client";

// eBay product search via SerpAPI's `engine=ebay` — same single API key as
// the Amazon provider, no separate credentials.
const NAME = "eBay";
const CURRENCY = process.env.SERPAPI_EBAY_CURRENCY || "USD";

interface SerpApiEbayItem {
  title?: string;
  link?: string;
  thumbnail?: string;
  price?: { extracted?: number };
  condition?: string;
  shipping?: string;
  rating?: number;
  reviews?: number;
}

interface SerpApiEbayResponse {
  organic_results?: SerpApiEbayItem[];
}

function toListing(item: SerpApiEbayItem): MarketplaceListing | null {
  const price = item.price?.extracted;
  if (!item.title || !item.link || typeof price !== "number") return null;
  return {
    title: item.title,
    price,
    currency: CURRENCY,
    url: item.link,
    imageUrl: item.thumbnail,
    condition: item.condition,
    rating: item.rating,
    reviewCount: item.reviews,
    freeShipping: item.shipping?.toLowerCase().includes("free"),
  };
}

async function search(query: string): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("ebay", NAME, query, "No search query provided.");

  if (!isSerpApiConfigured()) {
    return unavailableSummary(
      "ebay",
      NAME,
      trimmed,
      "eBay (via SerpAPI) is not connected. Add SERPAPI_API_KEY to enable live eBay data."
    );
  }

  const result = await fetchSerpApi<SerpApiEbayResponse>("ebay", { _nkw: trimmed });

  if (!result.ok) {
    return unavailableSummary("ebay", NAME, trimmed, result.error);
  }

  const listings = (result.data.organic_results ?? [])
    .map(toListing)
    .filter((l): l is MarketplaceListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("ebay", NAME, trimmed, "No live listings found on eBay for this query.");
  }

  const prices = listings.map((l) => l.price);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const ratings = listings.map((l) => l.rating).filter((r): r is number => typeof r === "number");
  const reviewCounts = listings.map((l) => l.reviewCount).filter((r): r is number => typeof r === "number");

  return {
    marketplace: "ebay",
    marketplaceName: NAME,
    available: true,
    query: trimmed,
    listingCount: listings.length,
    averagePrice: Math.round(averagePrice * 100) / 100,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    currency: CURRENCY,
    averageRating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : undefined,
    totalReviews: reviewCounts.length ? reviewCounts.reduce((s, r) => s + r, 0) : undefined,
    topListing: listings[0],
    listings: listings.slice(0, 10),
  };
}

export const serpApiEbayProvider: MarketplaceProvider = {
  id: "serpapi-ebay",
  marketplace: "ebay",
  name: NAME,
  isConfigured: isSerpApiConfigured,
  search,
};
