import type { MarketplaceProvider, MarketplaceSummary, ProductListing, ProviderStatus } from "../../types";
import { unavailableSummary } from "../../types";
import { buildMarketplaceSummary } from "../../aggregate";
import { getEbayConfig, isEbayConfigured } from "./config";
import { getEbayAccessToken, invalidateEbayAccessToken } from "./oauth";

// Direct eBay Browse API integration (official REST API, application
// access token via client_credentials — no SerpAPI in between, no seller
// login required). This is the only active eBay provider — serpApiEbayProvider
// (../serpapi/ebay.ts) is implemented but disabled (not registered in
// ../../registry.ts). This provider independently reports "Not Connected" if
// its own credentials are missing, without affecting anything else.
const NAME = "eBay";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const FETCH_TIMEOUT_MS = 8000;
const NOT_CONFIGURED_REASON =
  "eBay direct integration is not connected. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to enable live eBay data.";

interface EbayMoney {
  value?: string;
  currency?: string;
}

interface EbayItemSummary {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  price?: EbayMoney;
  condition?: string;
  seller?: { username?: string };
  itemLocation?: { country?: string };
  categories?: { categoryName?: string }[];
  shippingOptions?: { shippingCostType?: string; shippingCost?: EbayMoney }[];
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
  errors?: { message?: string }[];
}

function isFreeShipping(item: EbayItemSummary): boolean | undefined {
  const option = item.shippingOptions?.[0];
  if (!option) return undefined;
  if (option.shippingCostType === "FREE") return true;
  const cost = option.shippingCost?.value;
  return cost !== undefined ? Number(cost) === 0 : undefined;
}

function toListing(item: EbayItemSummary): ProductListing | null {
  const price = item.price?.value !== undefined ? Number(item.price.value) : undefined;
  if (!item.title || !item.itemWebUrl || price === undefined || Number.isNaN(price)) return null;

  return {
    id: `ebay:${item.itemId ?? item.itemWebUrl}`,
    title: item.title,
    marketplace: "ebay",
    price,
    currency: item.price?.currency ?? "USD",
    url: item.itemWebUrl,
    image: item.image?.imageUrl,
    condition: item.condition,
    seller: item.seller?.username,
    category: item.categories?.[0]?.categoryName,
    shippingInfo: { freeShipping: isFreeShipping(item), location: item.itemLocation?.country },
    rawData: item,
  };
}

async function getProviderStatus(): Promise<ProviderStatus> {
  return isEbayConfigured() ? { connected: true } : { connected: false, reason: NOT_CONFIGURED_REASON };
}

async function runSearch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": getEbayConfig()?.marketplaceId ?? "EBAY_US",
    },
  });
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("ebay", NAME, query, "No search query provided.");

  if (!isEbayConfigured()) {
    return unavailableSummary("ebay", NAME, trimmed, NOT_CONFIGURED_REASON);
  }

  const tokenResult = await getEbayAccessToken();
  if ("error" in tokenResult) {
    return unavailableSummary("ebay", NAME, trimmed, tokenResult.error);
  }

  const url = `${SEARCH_URL}?${new URLSearchParams({ q: trimmed, limit: "10" }).toString()}`;

  let res: Response;
  try {
    res = await runSearch(url, tokenResult.token);
    // A cached token can be rejected if eBay revoked it early — retry once
    // with a freshly minted one before giving up.
    if (res.status === 401) {
      invalidateEbayAccessToken();
      const retryToken = await getEbayAccessToken();
      if ("error" in retryToken) return unavailableSummary("ebay", NAME, trimmed, retryToken.error);
      res = await runSearch(url, retryToken.token);
    }
  } catch (err) {
    return unavailableSummary(
      "ebay",
      NAME,
      trimmed,
      err instanceof Error ? `eBay search request failed: ${err.message}` : "eBay search request failed."
    );
  }

  const data = (await res.json().catch(() => ({}))) as EbaySearchResponse;
  if (!res.ok) {
    const message = data.errors?.[0]?.message ?? `eBay Browse API returned HTTP ${res.status}.`;
    return unavailableSummary("ebay", NAME, trimmed, message);
  }

  const listings = (data.itemSummaries ?? []).map(toListing).filter((l): l is ProductListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("ebay", NAME, trimmed, "No live listings found on eBay for this query.");
  }

  return buildMarketplaceSummary("ebay", NAME, trimmed, listings, { currency: listings[0].currency, limit: 10 });
}

export const ebayDirectProvider: MarketplaceProvider = {
  id: "ebay-direct",
  marketplace: "ebay",
  name: NAME,
  isConfigured: isEbayConfigured,
  getProviderStatus,
  searchProducts,
};
