import { amazonProvider } from "./providers/amazon";
import { ebayDirectProvider } from "./providers/ebay/direct";
import { mercadoLibreProvider } from "./providers/mercadoLibre";
import { serpApiAmazonProvider, serpApiEbayProvider } from "./providers/serpapi";
import { walmartProvider } from "./providers/walmart";
import { unavailableSummary } from "./types";
import type { MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary, ProviderStatus } from "./types";

// This is the Unified Product Data Layer: every marketplace, regardless of
// vendor (SerpAPI, a direct PA-API, an OAuth-based integration like Mercado
// Libre, or a not-yet-built one) is just another entry in this array, all
// conforming to the same MarketplaceProvider interface. The AI Product
// Intelligence Engine (src/lib/engine) only ever calls
// `searchAllMarketplaces` below — it never imports a provider file directly,
// so no provider (including SerpAPI) is architected around; any of them can
// be added, removed, or swapped for a different vendor without the engine
// or its scoring logic changing at all.
//
// Order here is priority order — also what the engine uses to pick a
// "primary" summary when several are available for the same query (see
// hybridEngine.ts's pickPrimarySummary). SerpAPI is the primary, no-OAuth
// path; everything else is optional/secondary and never blocks the app when
// unconfigured. `ebayDirectProvider` and `walmartProvider` are prepared
// foundations for future integrations — always reporting themselves as not
// configured today, contributing nothing to a search, exactly like
// `amazonProvider` (the direct PA-API path) does until its credentials are
// set. Adding a new marketplace means implementing MarketplaceProvider and
// adding it here — nothing else in the app needs to change.
export const marketplaceProviders: MarketplaceProvider[] = [
  serpApiAmazonProvider,
  serpApiEbayProvider,
  mercadoLibreProvider,
  amazonProvider,
  ebayDirectProvider,
  walmartProvider,
];

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
// connected without hitting any marketplace's network.
export async function getAllProviderStatuses(): Promise<Record<string, ProviderStatus>> {
  const entries = await Promise.all(
    marketplaceProviders.map(async (provider) => [provider.id, await provider.getProviderStatus()] as const)
  );
  return Object.fromEntries(entries);
}

export type { ProductListing, MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary, ProviderStatus } from "./types";
export { getMercadoLibreCountry, MERCADO_LIBRE_COUNTRIES, DEFAULT_ML_COUNTRY } from "./countries";
export type { MercadoLibreCountry } from "./countries";
