import type { MarketplaceListing, MarketplaceProvider, MarketplaceSummary } from "../../types";
import { unavailableSummary } from "../../types";
import { isSerpApiConfigured } from "./config";
import { fetchSerpApi } from "./client";

// Amazon product search via SerpAPI's `engine=amazon` — a single API key,
// no OAuth, no Associates sales requirement. Field names follow SerpAPI's
// documented Amazon Search API response shape.
const NAME = "Amazon";
const AMAZON_DOMAIN = process.env.SERPAPI_AMAZON_DOMAIN || "amazon.com";
const CURRENCY = process.env.SERPAPI_AMAZON_CURRENCY || "USD";

interface SerpApiAmazonItem {
  title?: string;
  link?: string;
  thumbnail?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  is_prime?: boolean;
}

interface SerpApiAmazonResponse {
  organic_results?: SerpApiAmazonItem[];
}

function toListing(item: SerpApiAmazonItem): MarketplaceListing | null {
  if (!item.title || !item.link || typeof item.extracted_price !== "number") return null;
  return {
    title: item.title,
    price: item.extracted_price,
    currency: CURRENCY,
    url: item.link,
    imageUrl: item.thumbnail,
    rating: item.rating,
    reviewCount: item.reviews,
    freeShipping: item.is_prime,
  };
}

async function search(query: string): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("amazon", NAME, query, "No search query provided.");

  if (!isSerpApiConfigured()) {
    return unavailableSummary(
      "amazon",
      NAME,
      trimmed,
      "Amazon (via SerpAPI) is not connected. Add SERPAPI_API_KEY to enable live Amazon data."
    );
  }

  const result = await fetchSerpApi<SerpApiAmazonResponse>("amazon", {
    amazon_domain: AMAZON_DOMAIN,
    k: trimmed,
  });

  if (!result.ok) {
    return unavailableSummary("amazon", NAME, trimmed, result.error);
  }

  const listings = (result.data.organic_results ?? [])
    .map(toListing)
    .filter((l): l is MarketplaceListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("amazon", NAME, trimmed, "No live listings found on Amazon for this query.");
  }

  const prices = listings.map((l) => l.price);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const ratings = listings.map((l) => l.rating).filter((r): r is number => typeof r === "number");
  const reviewCounts = listings.map((l) => l.reviewCount).filter((r): r is number => typeof r === "number");

  return {
    marketplace: "amazon",
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

export const serpApiAmazonProvider: MarketplaceProvider = {
  id: "serpapi-amazon",
  marketplace: "amazon",
  name: NAME,
  isConfigured: isSerpApiConfigured,
  search,
};
