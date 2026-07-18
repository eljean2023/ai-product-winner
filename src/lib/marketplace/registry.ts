import { amazonProvider } from "./providers/amazon";
import { mercadoLibreProvider } from "./providers/mercadoLibre";
import { serpApiAmazonProvider, serpApiEbayProvider } from "./providers/serpapi";
import { unavailableSummary } from "./types";
import type { MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary } from "./types";

// The full list of live marketplaces, in priority order — this order is
// also what the engine uses to pick a "primary" summary when several are
// available for the same query (see hybridEngine.ts's pickPrimarySummary).
// SerpAPI is the primary, no-OAuth path; Mercado Libre and the direct
// Amazon PA-API are optional/secondary and never block the app when
// unconfigured. Adding a new marketplace means implementing
// MarketplaceProvider and adding it here — nothing else in the app needs
// to change.
export const marketplaceProviders: MarketplaceProvider[] = [
  serpApiAmazonProvider,
  serpApiEbayProvider,
  mercadoLibreProvider,
  amazonProvider,
];

export async function searchAllMarketplaces(
  query: string,
  opts?: MarketplaceSearchOptions
): Promise<MarketplaceSummary[]> {
  const results = await Promise.allSettled(
    marketplaceProviders.map((provider) => provider.search(query, opts))
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

export type { MarketplaceListing, MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary } from "./types";
export { getMercadoLibreCountry, MERCADO_LIBRE_COUNTRIES, DEFAULT_ML_COUNTRY } from "./countries";
export type { MercadoLibreCountry } from "./countries";
