import { randomBytes } from "node:crypto";
import { getMercadoLibreOAuthConfig } from "./mercadoLibreConfig";
import { clearTokenRecord, readTokenRecord, writeTokenRecord } from "./mercadoLibreTokenStore";
import type { MercadoLibreTokenRecord } from "./mercadoLibreTokenStore";

// Mercado Libre OAuth 2.0 — Authorization Code flow.
//
// Endpoints used (verified against Mercado Libre's current developer docs
// and confirmed by Mercado Libre's own reference examples, July 2026):
//
//   1. GET  {authDomain}/authorization
//      Where the user is redirected to log in and grant access. Params:
//      response_type=code, client_id, redirect_uri, state.
//      `authDomain` is country-specific (auth.mercadolibre.com.ar,
//      .com.mx, .com.br via mercadolivre.com.br, etc.) and must match the
//      country the application was registered under.
//
//   2. POST https://api.mercadolibre.com/oauth/token
//      Used for BOTH steps below — Mercado Libre only supports
//      grant_type=authorization_code and grant_type=refresh_token here.
//      `client_credentials` is NOT a supported grant type for this API and
//      always returns "unsupported_grant_type" (HTTP 400) — that is the bug
//      this module replaces.
//        a) grant_type=authorization_code: exchanges the one-time `code`
//           from the redirect for an access_token + refresh_token.
//           Params: grant_type, client_id, client_secret, code, redirect_uri.
//        b) grant_type=refresh_token: exchanges a still-valid refresh_token
//           for a new access_token (and a NEW refresh_token — Mercado
//           Libre's refresh tokens are single-use and rotate on every
//           refresh). Params: grant_type, client_id, client_secret,
//           refresh_token.
//      Access tokens expire in ~6 hours (`expires_in` in the response,
//      seconds). Refresh tokens expire after 6 months of disuse.
//
//   3. GET https://api.mercadolibre.com/users/me
//      Authenticated with the new access token, used once right after
//      login to resolve the human-readable account nickname for the
//      "Connected as <account>" status display.

const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const USER_INFO_URL = "https://api.mercadolibre.com/users/me";
const FETCH_TIMEOUT_MS = 8000;
const REFRESH_BUFFER_MS = 60_000;
const DEBUG_PREFIX = "[ML OAuth]";

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizationUrl(state: string): string | null {
  const config = getMercadoLibreOAuthConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });
  return `${config.authDomain}/authorization?${params.toString()}`;
}

interface MlTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  error?: string;
  error_description?: string;
  message?: string;
}

interface MlUserResponse {
  id?: number;
  nickname?: string;
  site_id?: string;
}

async function fetchUserInfo(accessToken: string): Promise<{ nickname?: string; siteId?: string }> {
  try {
    const res = await fetch(USER_INFO_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as MlUserResponse;
    return { nickname: data.nickname, siteId: data.site_id };
  } catch {
    return {};
  }
}

export type ExchangeResult = { ok: true; account: string } | { ok: false; error: string };

export async function exchangeCodeForToken(code: string): Promise<ExchangeResult> {
  const config = getMercadoLibreOAuthConfig();
  if (!config) {
    return {
      ok: false,
      error: "Mercado Libre is not configured (missing ML_CLIENT_ID, ML_CLIENT_SECRET, or ML_REDIRECT_URI).",
    };
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }).toString(),
    });

    const data = (await res.json().catch(() => ({}))) as MlTokenResponse;

    if (!res.ok || !data.access_token || !data.refresh_token) {
      const detail = data.message || data.error_description || data.error || `HTTP ${res.status}`;
      console.error(`${DEBUG_PREFIX} code exchange failed: ${detail}`);
      return { ok: false, error: `Mercado Libre rejected the authorization code: ${detail}` };
    }

    const { nickname, siteId } = await fetchUserInfo(data.access_token);
    const account = nickname ?? `Mercado Libre user ${data.user_id ?? ""}`.trim();

    const record: MercadoLibreTokenRecord = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in ?? 10_800) * 1000,
      userId: data.user_id ?? 0,
      nickname: account,
      siteId,
      obtainedAt: Date.now(),
    };
    await writeTokenRecord(record);
    console.log(`${DEBUG_PREFIX} connected as ${account} (user_id=${record.userId})`);
    return { ok: true, account };
  } catch (err) {
    console.error(`${DEBUG_PREFIX} code exchange threw`, err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Mercado Libre code exchange failed: ${err.message}`
          : "Mercado Libre code exchange failed unexpectedly.",
    };
  }
}

// Distinguishes "no token because nobody has connected yet" from "no token
// because a real request failed" — the two must never share a message,
// since the marketplace search UI shows the error text directly.
export type AccessTokenResult = { token: string; account: string } | { error: string };

let refreshInFlight: Promise<AccessTokenResult> | null = null;

export async function getValidAccessToken(): Promise<AccessTokenResult> {
  const record = await readTokenRecord();
  if (!record) return { error: "not-connected" };

  if (record.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return { token: record.accessToken, account: record.nickname };
  }

  // Coalesce concurrent callers into a single refresh — Mercado Libre's
  // refresh tokens are single-use, so two simultaneous refresh requests
  // would cause the second one to fail and invalidate the session.
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(record).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshAccessToken(record: MercadoLibreTokenRecord): Promise<AccessTokenResult> {
  const config = getMercadoLibreOAuthConfig();
  if (!config) return { error: "not-connected" };

  console.log(`${DEBUG_PREFIX} refreshing token for ${record.nickname}`);
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: record.refreshToken,
      }).toString(),
    });

    const data = (await res.json().catch(() => ({}))) as MlTokenResponse;

    if (!res.ok || !data.access_token) {
      const detail = data.message || data.error_description || data.error || `HTTP ${res.status}`;
      console.error(`${DEBUG_PREFIX} refresh failed: ${detail}`);
      // A dead refresh token (expired after 6 months, revoked, or already
      // consumed) can never succeed again — clear it so status/search fall
      // back to "Not Connected" instead of retrying a doomed token forever.
      if (res.status === 400 || res.status === 401) await clearTokenRecord();
      return {
        error: `Mercado Libre session expired or was revoked (${detail}). Please reconnect Mercado Libre.`,
      };
    }

    const updated: MercadoLibreTokenRecord = {
      ...record,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? record.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 10_800) * 1000,
    };
    await writeTokenRecord(updated);
    return { token: updated.accessToken, account: updated.nickname };
  } catch (err) {
    console.error(`${DEBUG_PREFIX} refresh threw`, err);
    return {
      error:
        err instanceof Error
          ? `Mercado Libre token refresh failed: ${err.message}`
          : "Mercado Libre token refresh failed unexpectedly.",
    };
  }
}

export async function disconnectMercadoLibre(): Promise<void> {
  await clearTokenRecord();
}

export async function getConnectionStatus(): Promise<
  { connected: false } | { connected: true; account: string }
> {
  const result = await getValidAccessToken();
  if ("error" in result) return { connected: false };
  return { connected: true, account: result.account };
}
