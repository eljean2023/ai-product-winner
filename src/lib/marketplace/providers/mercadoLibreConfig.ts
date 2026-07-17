// Single source of truth for "is Mercado Libre configured". Every
// component, API route, and provider must call `isMercadoLibreConfigured()`
// (or `getMercadoLibreCredentials()` if it needs the values) instead of
// re-reading process.env.ML_CLIENT_ID / ML_CLIENT_SECRET itself — that way
// there is exactly one place that knows which env vars matter.
export interface MercadoLibreCredentials {
  clientId: string;
  clientSecret: string;
}

export function getMercadoLibreCredentials(): MercadoLibreCredentials | null {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isMercadoLibreConfigured(): boolean {
  return getMercadoLibreCredentials() !== null;
}
