import { getMercadoLibreCountry, mercadoLibreSearchUrl } from "../countries";
import type {
  MarketplaceProvider,
  MarketplaceSearchOptions,
  MarketplaceSummary,
  ProductListing,
  ProviderStatus,
} from "../types";
import { unavailableSummary } from "../types";
import { buildMarketplaceSummary } from "../aggregate";
import { isMercadoLibreConfigured } from "./mercadoLibreConfig";
import { getConnectionStatus, getValidAccessToken } from "./mercadoLibreOAuth";

const NAME = "Mercado Libre";
const FETCH_TIMEOUT_MS = 8000;
const DEBUG_PREFIX = "[ML]";

// As of Mercado Libre's 2023 API changes, /sites/{site}/search requires an
// OAuth access token even for public search results (unauthenticated calls
// now get a flat 403). Mercado Libre does NOT support the client_credentials
// grant for this API — the token must come from a user completing the
// Authorization Code flow (see ./mercadoLibreOAuth and the
// /api/marketplace/mercadolibre/connect route). Until an account is
// connected, this provider reports "Not Connected" — it never falls back
// to scraping. Once connected, any *other* failure (expired session, rate
// limit, network error, ...) must surface as its own distinct reason —
// never get relabeled as "not connected".

interface MlSearchItem {
  title?: string;
  price?: number;
  currency_id?: string;
  permalink?: string;
  thumbnail?: string;
  condition?: string;
  category_id?: string;
  seller?: { id?: number; nickname?: string };
  shipping?: { free_shipping?: boolean };
  address?: { state_name?: string; city_name?: string };
  seller_address?: { state?: { name?: string }; city?: { name?: string } };
}

interface MlSearchResponse {
  results?: MlSearchItem[];
}

interface MlReviewsResponse {
  rating_average?: number;
  total_reviews?: number;
}

interface MlCategoryResponse {
  name?: string;
}

// Category names take a second lookup (search only returns category_id).
// Cached indefinitely since a category's name essentially never changes —
// best-effort only, a failed lookup just leaves `category` undefined.
const categoryNameCache = new Map<string, string>();

async function resolveCategoryName(categoryId: string | undefined, token: string): Promise<string | undefined> {
  if (!categoryId) return undefined;
  const cached = categoryNameCache.get(categoryId);
  if (cached) return cached;

  try {
    const res = await fetchWithAuth(`https://api.mercadolibre.com/categories/${categoryId}`, token);
    if (!res.ok) return undefined;
    const data = (await res.json()) as MlCategoryResponse;
    if (!data.name) return undefined;
    categoryNameCache.set(categoryId, data.name);
    return data.name;
  } catch {
    return undefined;
  }
}

function locationFromItem(item: MlSearchItem): string | undefined {
  const state = item.address?.state_name ?? item.seller_address?.state?.name;
  const city = item.address?.city_name ?? item.seller_address?.city?.name;
  if (city && state) return `${city}, ${state}`;
  return state ?? city ?? undefined;
}

function toListing(item: MlSearchItem, categoryName: string | undefined): ProductListing | null {
  if (!item.title || typeof item.price !== "number" || !item.permalink) return null;
  return {
    id: `mercadolibre:${item.permalink}`,
    title: item.title,
    marketplace: "mercadolibre",
    price: item.price,
    currency: item.currency_id ?? "",
    url: item.permalink,
    image: item.thumbnail,
    seller: item.seller?.nickname,
    condition: item.condition,
    category: categoryName,
    shippingInfo: { freeShipping: item.shipping?.free_shipping, location: locationFromItem(item) },
    rawData: item,
  };
}

async function getProviderStatus(): Promise<ProviderStatus> {
  if (!isMercadoLibreConfigured()) {
    return {
      connected: false,
      reason:
        "Mercado Libre is not configured. Set ML_CLIENT_ID, ML_CLIENT_SECRET, and ML_REDIRECT_URI to enable Mercado Libre login.",
    };
  }
  const status = await getConnectionStatus();
  return status.connected
    ? { connected: true }
    : {
        connected: false,
        reason: "Mercado Libre is not connected. Visit /api/marketplace/mercadolibre/connect to authorize your account.",
      };
}

async function fetchWithAuth(url: string, token: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
}

// Best-effort only: fetches rating/review count for a single representative
// item. Never blocks the main summary and never fabricates a value if it
// fails — the fields are simply left undefined.
async function tryFetchReviews(itemId: string | undefined, token: string): Promise<{ rating?: number; total?: number }> {
  if (!itemId) return {};
  try {
    const res = await fetchWithAuth(`https://api.mercadolibre.com/reviews/item/${itemId}`, token);
    if (!res.ok) return {};
    const data = (await res.json()) as MlReviewsResponse;
    return { rating: data.rating_average, total: data.total_reviews };
  } catch {
    return {};
  }
}

function extractItemId(permalink: string): string | undefined {
  const match = permalink.match(/(MLM|MLA|MLB|MCO|MLC|MPE|MLU|MEC)-?\d+/i);
  return match ? match[0].replace("-", "") : undefined;
}

async function searchProducts(query: string, opts: MarketplaceSearchOptions = {}): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("mercadolibre", NAME, query, "No search query provided.");

  if (!isMercadoLibreConfigured()) {
    console.log(`${DEBUG_PREFIX} not configured — ML_CLIENT_ID/ML_CLIENT_SECRET/ML_REDIRECT_URI missing`);
    return unavailableSummary(
      "mercadolibre",
      NAME,
      trimmed,
      "Mercado Libre is not configured. Set ML_CLIENT_ID, ML_CLIENT_SECRET, and ML_REDIRECT_URI to enable Mercado Libre login."
    );
  }

  const tokenResult = await getValidAccessToken();
  if ("error" in tokenResult) {
    if (tokenResult.error === "not-connected") {
      return unavailableSummary(
        "mercadolibre",
        NAME,
        trimmed,
        "Mercado Libre is not connected. Visit /api/marketplace/mercadolibre/connect to authorize your account."
      );
    }
    // Credentials ARE present and a connection was made at some point —
    // this is a real failure (expired session, rate limit, network error,
    // ...), never "not connected".
    return unavailableSummary("mercadolibre", NAME, trimmed, tokenResult.error);
  }
  const token = tokenResult.token;

  const country = getMercadoLibreCountry(opts.country);
  const limit = Math.min(opts.limit ?? 30, 50);
  const url = mercadoLibreSearchUrl(country, trimmed, limit);

  console.log(`${DEBUG_PREFIX} search request: ${url}`);

  let payload: MlSearchResponse;
  try {
    const res = await fetchWithAuth(url, token);
    console.log(`${DEBUG_PREFIX} search response: ${res.status}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`${DEBUG_PREFIX} search failed: ${res.status} ${detail}`);
      if (res.status === 401 || res.status === 403) {
        return unavailableSummary(
          "mercadolibre",
          NAME,
          trimmed,
          `Mercado Libre (${country.label}) rejected the search request (HTTP ${res.status}). ${detail || "The access token may be invalid or lack the required scope."}`.trim()
        );
      }
      if (res.status === 429) {
        return unavailableSummary(
          "mercadolibre",
          NAME,
          trimmed,
          `Mercado Libre (${country.label}) rate-limited this search (HTTP 429). Try again shortly.`
        );
      }
      return unavailableSummary(
        "mercadolibre",
        NAME,
        trimmed,
        `Mercado Libre (${country.label}) search returned HTTP ${res.status}. ${detail}`.trim()
      );
    }
    payload = (await res.json()) as MlSearchResponse;
  } catch (err) {
    console.error(`${DEBUG_PREFIX} search request threw`, err);
    return unavailableSummary(
      "mercadolibre",
      NAME,
      trimmed,
      err instanceof Error ? `Mercado Libre search error: ${err.message}` : "Mercado Libre search failed."
    );
  }

  const rawItems = payload.results ?? [];
  const uniqueCategoryIds = Array.from(
    new Set(rawItems.map((item) => item.category_id).filter((id): id is string => Boolean(id)))
  );
  const categoryNames = new Map<string, string | undefined>(
    await Promise.all(
      uniqueCategoryIds.map(async (id) => [id, await resolveCategoryName(id, token)] as const)
    )
  );

  const listings = rawItems
    .map((item) => toListing(item, item.category_id ? categoryNames.get(item.category_id) : undefined))
    .filter((l): l is ProductListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary(
      "mercadolibre",
      NAME,
      trimmed,
      `No live listings found on Mercado Libre (${country.label}) for this query.`
    );
  }

  const topListing = listings[0];
  const { rating, total } = await tryFetchReviews(extractItemId(topListing.url), token);
  if (rating !== undefined) topListing.rating = rating;
  if (total !== undefined) topListing.reviewCount = total;

  return buildMarketplaceSummary("mercadolibre", NAME, trimmed, listings, { currency: country.currency });
}

export const mercadoLibreProvider: MarketplaceProvider = {
  id: "mercadolibre",
  marketplace: "mercadolibre",
  name: NAME,
  isConfigured: isMercadoLibreConfigured,
  getProviderStatus,
  searchProducts,
};
