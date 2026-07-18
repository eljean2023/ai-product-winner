import type { MarketplaceProvider, MarketplaceSummary, ProductListing, ProviderStatus } from "../../types";
import { unavailableSummary } from "../../types";
import { buildMarketplaceSummary } from "../../aggregate";
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

function toListing(item: SerpApiEbayItem): ProductListing | null {
  const price = item.price?.extracted;
  if (!item.title || !item.link || typeof price !== "number") return null;
  return {
    id: `ebay:${item.link}`,
    title: item.title,
    marketplace: "ebay",
    price,
    currency: CURRENCY,
    url: item.link,
    image: item.thumbnail,
    condition: item.condition,
    rating: item.rating,
    reviewCount: item.reviews,
    shippingInfo: { freeShipping: item.shipping?.toLowerCase().includes("free") },
    rawData: item,
  };
}

async function getProviderStatus(): Promise<ProviderStatus> {
  return isSerpApiConfigured()
    ? { connected: true }
    : { connected: false, reason: "eBay (via SerpAPI) is not connected. Add SERPAPI_API_KEY to enable live eBay data." };
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
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
    .filter((l): l is ProductListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("ebay", NAME, trimmed, "No live listings found on eBay for this query.");
  }

  return buildMarketplaceSummary("ebay", NAME, trimmed, listings, { currency: CURRENCY, limit: 10 });
}

export const serpApiEbayProvider: MarketplaceProvider = {
  id: "serpapi-ebay",
  marketplace: "ebay",
  name: NAME,
  isConfigured: isSerpApiConfigured,
  getProviderStatus,
  searchProducts,
};
