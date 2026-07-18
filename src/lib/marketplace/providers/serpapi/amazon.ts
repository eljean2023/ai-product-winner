import type { MarketplaceProvider, MarketplaceSummary, ProductListing, ProviderStatus } from "../../types";
import { unavailableSummary } from "../../types";
import { buildMarketplaceSummary } from "../../aggregate";
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

function toListing(item: SerpApiAmazonItem): ProductListing | null {
  if (!item.title || !item.link || typeof item.extracted_price !== "number") return null;
  return {
    id: `amazon:${item.link}`,
    title: item.title,
    marketplace: "amazon",
    price: item.extracted_price,
    currency: CURRENCY,
    url: item.link,
    image: item.thumbnail,
    rating: item.rating,
    reviewCount: item.reviews,
    shippingInfo: { freeShipping: item.is_prime },
    rawData: item,
  };
}

async function getProviderStatus(): Promise<ProviderStatus> {
  return isSerpApiConfigured()
    ? { connected: true }
    : { connected: false, reason: "Amazon (via SerpAPI) is not connected. Add SERPAPI_API_KEY to enable live Amazon data." };
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
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
    .filter((l): l is ProductListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("amazon", NAME, trimmed, "No live listings found on Amazon for this query.");
  }

  return buildMarketplaceSummary("amazon", NAME, trimmed, listings, { currency: CURRENCY, limit: 10 });
}

export const serpApiAmazonProvider: MarketplaceProvider = {
  id: "serpapi-amazon",
  marketplace: "amazon",
  name: NAME,
  isConfigured: isSerpApiConfigured,
  getProviderStatus,
  searchProducts,
};
