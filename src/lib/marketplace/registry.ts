import { amazonProvider } from "./providers/amazon";
import { ebayDirectProvider } from "./providers/ebay/direct";
import { mercadoLibreProvider } from "./providers/mercadoLibre";
import { serpApiAmazonProvider, serpApiEbayProvider } from "./providers/serpapi";
import { walmartProvider } from "./providers/walmart";
import { unavailableSummary } from "./types";
import type { MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary, ProviderStatus } from "./types";

// This is the Unified Product Data Layer: every marketplace, regardless of
// vendor (a direct PA-API, an OAuth-based integration like Mercado Libre, or
// a not-yet-built one) is just another entry in this array, all conforming
// to the same MarketplaceProvider interface. The AI Product Intelligence
// Engine (src/lib/engine) only ever calls `searchAllMarketplaces` below — it
// never imports a provider file directly, so no provider is architected
// around; any of them can be added, removed, or swapped for a different
// vendor without the engine or its scoring logic changing at all.
//
// Order here is priority order — also what the engine uses to pick a
// "primary" summary when several are available for the same query (see
// hybridEngine.ts's pickPrimarySummary). Every provider independently
// reports "Not Connected" without blocking the others when its own
// credentials are missing. Adding a new marketplace means implementing
// MarketplaceProvider and adding it here — nothing else in the app needs to
// change.
//
// SerpAPI is intentionally NOT included here. The app runs entirely on
// official marketplace APIs (Amazon PA-API, eBay Browse API, Mercado Libre,
// Walmart Affiliate API) with zero runtime dependency on SerpAPI — no
// SerpAPI request is ever made, whether or not SERPAPI_API_KEY is set.
// SerpAPI's providers remain fully implemented (see ./providers/serpapi)
// and are exported below as `disabledProviders`, kept only as a future
// fallback; re-enabling one requires deliberately adding it back into
// `marketplaceProviders`. Keepa is also excluded, for a different reason:
// it's a HistoricalIntelligenceProvider, not a MarketplaceProvider — it
// enriches an already-found Amazon listing by ASIN and never participates
// in a marketplace search (see ./providers/keepa).
export const marketplaceProviders: MarketplaceProvider[] = [
  amazonProvider,
  ebayDirectProvider,
  mercadoLibreProvider,
  walmartProvider,
];

// Disabled by design — not part of the active search/registry flow. See the
// comment above. Kept importable so the implementation isn't lost, and
// exported (rather than left as an unused import) so lint doesn't flag it.
export const disabledProviders: MarketplaceProvider[] = [serpApiAmazonProvider, serpApiEbayProvider];

export async function searchAllMarketplaces(
  query: string,
  opts?: MarketplaceSearchOptions
): Promise<MarketplaceSummary[]> {
  const results = await Promise.allSettled(
    marketplaceProviders.map((provider) => provider.searchProducts(query, opts))
  );

  return results.map((result, i) => {
    const provider = marketplaceProviders[i];
    if (result.status === "fulfilled") return result.value;
    return unavailableSummary(
      provider.marketplace,
      provider.name,
      query,
      result.reason instanceof Error ? result.reason.message : "Marketplace lookup failed."
    );
  });
}

// Connection status for every registered provider, without performing a
// search — used by /api/marketplace/status so the UI can show what's
// connected without hitting any marketplace's network. Uses allSettled (like
// searchAllMarketplaces above) so one provider's status check throwing can
// never blank out every other provider's real status.
export async function getAllProviderStatuses(): Promise<Record<string, ProviderStatus>> {
  const results = await Promise.allSettled(
    marketplaceProviders.map((provider) => provider.getProviderStatus())
  );

  const entries = results.map((result, i) => {
    const provider = marketplaceProviders[i];
    if (result.status === "fulfilled") return [provider.id, { ...result.value, configured: provider.isConfigured() }] as const;
    const reason = result.reason instanceof Error ? result.reason.message : "Status check failed.";
    return [provider.id, { connected: false, reason, configured: provider.isConfigured() }] as const;
  });

  return Object.fromEntries(entries);
}

export type { ProductListing, MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary, ProviderStatus } from "./types";
export { getMercadoLibreCountry, MERCADO_LIBRE_COUNTRIES, DEFAULT_ML_COUNTRY } from "./countries";
export type { MercadoLibreCountry } from "./countries";
