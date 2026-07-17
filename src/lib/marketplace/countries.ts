// Mercado Libre operates one marketplace per country, each with its own
// "site ID", currency, and domain. Nothing about a specific country is
// hardcoded anywhere else — every provider/route call resolves a country
// code through this table, falling back to DEFAULT_ML_COUNTRY when unset.

export interface MercadoLibreCountry {
  code: string;
  siteId: string;
  label: string;
  currency: string;
  domain: string;
}

export const MERCADO_LIBRE_COUNTRIES: MercadoLibreCountry[] = [
  { code: "MX", siteId: "MLM", label: "Mexico", currency: "MXN", domain: "mercadolibre.com.mx" },
  { code: "AR", siteId: "MLA", label: "Argentina", currency: "ARS", domain: "mercadolibre.com.ar" },
  { code: "BR", siteId: "MLB", label: "Brazil", currency: "BRL", domain: "mercadolivre.com.br" },
  { code: "CO", siteId: "MCO", label: "Colombia", currency: "COP", domain: "mercadolibre.com.co" },
  { code: "CL", siteId: "MLC", label: "Chile", currency: "CLP", domain: "mercadolibre.cl" },
  { code: "PE", siteId: "MPE", label: "Peru", currency: "PEN", domain: "mercadolibre.com.pe" },
  { code: "UY", siteId: "MLU", label: "Uruguay", currency: "UYU", domain: "mercadolibre.com.uy" },
  { code: "EC", siteId: "MEC", label: "Ecuador", currency: "USD", domain: "mercadolibre.com.ec" },
];

export const DEFAULT_ML_COUNTRY = "MX";

export function getMercadoLibreCountry(code?: string): MercadoLibreCountry {
  const found = code
    ? MERCADO_LIBRE_COUNTRIES.find((c) => c.code === code.toUpperCase())
    : undefined;
  return (
    found ??
    MERCADO_LIBRE_COUNTRIES.find((c) => c.code === DEFAULT_ML_COUNTRY)!
  );
}

export function mercadoLibreSearchUrl(country: MercadoLibreCountry, query: string, limit: number): string {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return `https://api.mercadolibre.com/sites/${country.siteId}/search?${params.toString()}`;
}
