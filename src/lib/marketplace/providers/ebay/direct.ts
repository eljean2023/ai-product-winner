import type { MarketplaceProvider, MarketplaceSummary, ProviderStatus } from "../../types";
import { unavailableSummary } from "../../types";

// Prepared, not live: the direct eBay Browse/Finding API integration (its
// own OAuth app credentials, no SerpAPI in between). eBay search today comes
// from serpApiEbayProvider (../serpapi/ebay.ts) — this provider exists so a
// future direct integration is a pure implementation task, not an
// architecture change: it's already registered in registry.ts, already
// conforms to MarketplaceProvider, and already reports itself honestly as
// not configured. No credentials are read or network calls made.
const NAME = "eBay";
const NOT_CONFIGURED_REASON = "eBay direct integration is not configured yet — currently prepared but inactive.";

async function getProviderStatus(): Promise<ProviderStatus> {
  return { connected: false, reason: NOT_CONFIGURED_REASON };
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
  return unavailableSummary("ebay", NAME, query, NOT_CONFIGURED_REASON);
}

export const ebayDirectProvider: MarketplaceProvider = {
  id: "ebay-direct",
  marketplace: "ebay",
  name: NAME,
  isConfigured: () => false,
  getProviderStatus,
  searchProducts,
};
