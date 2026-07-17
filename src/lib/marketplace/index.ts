// Public surface of the marketplace layer for UI consumption (rendering
// marketplace chips, buttons, and the country selector). The engine talks
// to `./registry` directly; this barrel is for display-only needs.
export type {
  MarketplaceId,
  MarketplaceListing,
  MarketplaceSearchOptions,
  MarketplaceSummary,
} from "./types";
export { DEFAULT_ML_COUNTRY, MERCADO_LIBRE_COUNTRIES, getMercadoLibreCountry } from "./countries";
export type { MercadoLibreCountry } from "./countries";
