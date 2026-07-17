import { getMercadoLibreCountry, mercadoLibreSearchUrl } from "../countries";
import type {
  MarketplaceListing,
  MarketplaceProvider,
  MarketplaceSearchOptions,
  MarketplaceSummary,
} from "../types";
import { unavailableSummary } from "../types";

const NAME = "Mercado Libre";
const FETCH_TIMEOUT_MS = 8000;

// As of Mercado Libre's 2023 API changes, /sites/{site}/search requires an
// OAuth access token even for public search results (unauthenticated calls
// now get a flat 403). A free developer account (no sales requirement,
// unlike Amazon's Associates program) at developers.mercadolibre.com
// provides a client id/secret for the client_credentials grant. Until
// those are configured, this provider reports "Not Connected" — it never
// falls back to scraping.
function readCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  const credentials = readCredentials();
  if (!credentials) return null;

  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  try {
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }).toString(),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    };
    return tokenCache.token;
  } catch {
    return null;
  }
}

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

function toListing(item: MlSearchItem, categoryName: string | undefined): MarketplaceListing | null {
  if (!item.title || typeof item.price !== "number" || !item.permalink) return null;
  return {
    title: item.title,
    price: item.price,
    currency: item.currency_id ?? "",
    url: item.permalink,
    imageUrl: item.thumbnail,
    seller: item.seller?.nickname,
    condition: item.condition,
    category: categoryName,
    freeShipping: item.shipping?.free_shipping,
    location: locationFromItem(item),
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

async function search(query: string, opts: MarketplaceSearchOptions = {}): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("mercadolibre", NAME, query, "No search query provided.");

  const token = await getAccessToken();
  if (!token) {
    return unavailableSummary(
      "mercadolibre",
      NAME,
      trimmed,
      "Mercado Libre is not connected. Add ML_CLIENT_ID and ML_CLIENT_SECRET (free at developers.mercadolibre.com) to enable live Mercado Libre data."
    );
  }

  const country = getMercadoLibreCountry(opts.country);
  const limit = Math.min(opts.limit ?? 30, 50);
  const url = mercadoLibreSearchUrl(country, trimmed, limit);

  let payload: MlSearchResponse;
  try {
    const res = await fetchWithAuth(url, token);
    if (!res.ok) {
      return unavailableSummary(
        "mercadolibre",
        NAME,
        trimmed,
        `Mercado Libre (${country.label}) search returned ${res.status}.`
      );
    }
    payload = (await res.json()) as MlSearchResponse;
  } catch (err) {
    return unavailableSummary(
      "mercadolibre",
      NAME,
      trimmed,
      err instanceof Error ? err.message : "Mercado Libre search failed."
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
    .filter((l): l is MarketplaceListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary(
      "mercadolibre",
      NAME,
      trimmed,
      `No live listings found on Mercado Libre (${country.label}) for this query.`
    );
  }

  const prices = listings.map((l) => l.price);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const sellerCount = new Set(listings.map((l) => l.seller).filter(Boolean)).size;
  const topListing = listings[0];

  const { rating, total } = await tryFetchReviews(extractItemId(topListing.url), token);
  if (rating !== undefined) topListing.rating = rating;
  if (total !== undefined) topListing.reviewCount = total;

  return {
    marketplace: "mercadolibre",
    marketplaceName: NAME,
    available: true,
    query: trimmed,
    listingCount: listings.length,
    averagePrice: Math.round(averagePrice * 100) / 100,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    currency: country.currency,
    sellerCount: sellerCount || undefined,
    averageRating: rating,
    totalReviews: total,
    topListing,
    listings,
  };
}

export const mercadoLibreProvider: MarketplaceProvider = {
  id: "mercadolibre",
  name: NAME,
  isConfigured: () => readCredentials() !== null,
  search,
};
