import { amazonProvider } from "./providers/amazon";
import { mercadoLibreProvider } from "./providers/mercadoLibre";
import { unavailableSummary } from "./types";
import type { MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary } from "./types";

// The full list of live marketplaces. Adding a new one (Walmart, eBay,
// AliExpress, Etsy, ...) means implementing MarketplaceProvider and adding
// it here — nothing else in the app needs to change.
export const marketplaceProviders: MarketplaceProvider[] = [mercadoLibreProvider, amazonProvider];

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
      provider.id,
      provider.name,
      query,
      result.reason instanceof Error ? result.reason.message : "Marketplace lookup failed."
    );
  });
}

export type { MarketplaceListing, MarketplaceProvider, MarketplaceSearchOptions, MarketplaceSummary } from "./types";
export { getMercadoLibreCountry, MERCADO_LIBRE_COUNTRIES, DEFAULT_ML_COUNTRY } from "./countries";
export type { MercadoLibreCountry } from "./countries";
