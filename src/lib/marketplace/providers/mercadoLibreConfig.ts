// Single source of truth for "is Mercado Libre configured". Every
// component, API route, and provider must call `isMercadoLibreConfigured()`
// (or `getMercadoLibreOAuthConfig()` if it needs the values) instead of
// re-reading process.env itself — that way there is exactly one place that
// knows which env vars matter.
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

export interface MercadoLibreOAuthConfig extends MercadoLibreCredentials {
  // Full callback URL registered on the Mercado Libre application (must
  // match exactly what's configured at developers.mercadolibre.com — ML
  // rejects any mismatch, even a trailing slash).
  redirectUri: string;
  // Country-specific authorization domain, e.g. https://auth.mercadolibre.com.ar
  // or https://auth.mercadolibre.com.mx. Must correspond to the country the
  // ML application itself was registered in — defaults to Argentina, the
  // domain used in Mercado Libre's own reference examples, but should be
  // overridden via ML_AUTH_DOMAIN to match the app's registered site.
  authDomain: string;
}

const DEFAULT_AUTH_DOMAIN = "https://auth.mercadolibre.com.ar";

export function getMercadoLibreOAuthConfig(): MercadoLibreOAuthConfig | null {
  const credentials = getMercadoLibreCredentials();
  const redirectUri = process.env.ML_REDIRECT_URI;
  if (!credentials || !redirectUri) return null;
  return {
    ...credentials,
    redirectUri,
    authDomain: process.env.ML_AUTH_DOMAIN || DEFAULT_AUTH_DOMAIN,
  };
}

// "Configured" now means the app has everything it needs to *start* the
// OAuth authorization-code flow (client id/secret + redirect URI) — it does
// NOT mean a user has completed login. For that, see
// `getConnectionStatus()` in ./mercadoLibreOAuth.
export function isMercadoLibreConfigured(): boolean {
  return getMercadoLibreOAuthConfig() !== null;
}
