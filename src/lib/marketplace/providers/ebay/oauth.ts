import { getEbayConfig } from "./config";

// eBay OAuth 2.0 — Client Credentials grant (see
// https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html).
// This is an *application* token, not tied to any user/seller account — it
// authorizes public read-only calls like Browse API search, obtained with
// just the app's own client id/secret, no login or redirect flow required.
// Unlike Mercado Libre, eBay's client_credentials grant is fully supported
// and is the intended way to call Browse API search.
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SCOPE = "https://api.ebay.com/oauth/api_scope";
const FETCH_TIMEOUT_MS = 8000;
const REFRESH_BUFFER_MS = 60_000;

interface EbayTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// In-memory only, unlike Mercado Libre's on-disk store — an application
// token carries no user identity to persist and is trivially re-obtained
// with the same client id/secret after a restart.
let cached: CachedToken | null = null;
let fetchInFlight: Promise<{ token: string } | { error: string }> | null = null;

export type EbayTokenResult = { token: string } | { error: string };

export async function getEbayAccessToken(): Promise<EbayTokenResult> {
  if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return { token: cached.token };
  }
  if (!fetchInFlight) {
    fetchInFlight = fetchNewToken().finally(() => {
      fetchInFlight = null;
    });
  }
  return fetchInFlight;
}

// Discards the cached token so the next call re-authenticates — used after
// a search request comes back 401 Unauthorized despite a cached token
// (e.g. eBay revoked it early), never called speculatively.
export function invalidateEbayAccessToken(): void {
  cached = null;
}

async function fetchNewToken(): Promise<EbayTokenResult> {
  const config = getEbayConfig();
  if (!config) return { error: "eBay is not configured (missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET)." };

  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }).toString(),
    });

    const data = (await res.json().catch(() => ({}))) as EbayTokenResponse;
    if (!res.ok || !data.access_token) {
      const detail = data.error_description || data.error || `HTTP ${res.status}`;
      return { error: `eBay authentication failed: ${detail}` };
    }

    cached = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    return { token: cached.token };
  } catch (err) {
    return {
      error: err instanceof Error ? `eBay authentication request failed: ${err.message}` : "eBay authentication request failed.",
    };
  }
}
