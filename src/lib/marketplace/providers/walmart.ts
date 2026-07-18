import type { MarketplaceProvider, MarketplaceSummary, ProviderStatus } from "../types";
import { unavailableSummary } from "../types";

// Prepared, not live: a future Walmart marketplace integration. Same shape
// as any other MarketplaceProvider so wiring in a real API later (Walmart's
// own Marketplace API, or a SerpAPI walmart engine) is an implementation
// task, not an architecture change. No credentials are read or network
// calls made.
const NAME = "Walmart";
const NOT_CONFIGURED_REASON = "Walmart integration is not configured yet — currently prepared but inactive.";

async function getProviderStatus(): Promise<ProviderStatus> {
  return { connected: false, reason: NOT_CONFIGURED_REASON };
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
  return unavailableSummary("walmart", NAME, query, NOT_CONFIGURED_REASON);
}

export const walmartProvider: MarketplaceProvider = {
  id: "walmart",
  marketplace: "walmart",
  name: NAME,
  isConfigured: () => false,
  getProviderStatus,
  searchProducts,
};
