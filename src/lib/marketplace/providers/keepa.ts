import type { HistoricalIntelligenceProvider, ProductHistory, ProviderStatus } from "../types";

// Prepared, not live: Keepa's historical intelligence (price history, sales
// rank, trend/demand validation over time) for an already-known ASIN. This
// is deliberately not a MarketplaceProvider — Keepa doesn't do query search,
// it enriches a listing the app already found — so it's never registered in
// registry.ts and never touches searchAllMarketplaces. No credentials are
// read or network calls made; wiring in the real Keepa API later is an
// implementation task, not an architecture change.
const NAME = "Keepa";
const NOT_CONFIGURED_REASON = "Keepa integration is not configured yet — currently prepared but inactive.";

async function getProviderStatus(): Promise<ProviderStatus> {
  return { connected: false, reason: NOT_CONFIGURED_REASON };
}

async function getProductHistory(): Promise<ProductHistory | null> {
  return null;
}

export const keepaProvider: HistoricalIntelligenceProvider = {
  id: "keepa",
  name: NAME,
  getProviderStatus,
  getProductHistory,
};
