import { sign } from "node:crypto";
import type { MarketplaceProvider, MarketplaceSummary, ProductListing, ProviderStatus } from "../types";
import { unavailableSummary } from "../types";
import { buildMarketplaceSummary } from "../aggregate";

// Walmart Affiliate API v2 (developer.api.walmart.com/api-proxy/service/affil) —
// the official Walmart I/O product-search API, gated behind an approved
// Impact.com affiliate/publisher account. Auth is RSA-signature based (no
// OAuth token endpoint): every request carries a signature of
// `consumerId\ntimestamp\nkeyVersion\n` signed with the account's private
// key, verified by Walmart against the matching public key uploaded to the
// Walmart I/O dashboard. Until all four credentials below are set, `search`
// returns an `available: false` "Not Connected" summary without ever
// hitting the network, so the rest of the app is unaffected.
const NAME = "Walmart";
const SEARCH_URL = "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search";
const FETCH_TIMEOUT_MS = 8000;

interface WalmartConfig {
  consumerId: string;
  privateKey: string;
  keyVersion: string;
  publisherId: string;
}

function readConfig(): WalmartConfig | null {
  const consumerId = process.env.WALMART_CONSUMER_ID;
  const rawPrivateKey = process.env.WALMART_PRIVATE_KEY;
  const publisherId = process.env.WALMART_PUBLISHER_ID;
  if (!consumerId || !rawPrivateKey || !publisherId) return null;

  return {
    consumerId,
    // Env vars can't hold real newlines, so a PEM key is stored with
    // literal "\n" sequences — restore them before handing the key to
    // node:crypto, which requires an actual multi-line PEM.
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    keyVersion: process.env.WALMART_KEY_VERSION || "1",
    publisherId,
  };
}

const NOT_CONNECTED_REASON =
  "Walmart Affiliate API is not connected. Add WALMART_CONSUMER_ID, WALMART_PRIVATE_KEY, WALMART_KEY_VERSION, and WALMART_PUBLISHER_ID to enable live Walmart data.";

// Builds the four WM_* auth headers Walmart requires on every request. See
// https://walmart.io — "Authentication": sign
// `${consumerId}\n${timestampMs}\n${keyVersion}\n` with the account's RSA
// private key (SHA256, PKCS#1 v1.5 padding) and send the signature
// alongside the raw values so Walmart can verify it against the public key
// on file for this consumer id.
function buildAuthHeaders(config: WalmartConfig): Record<string, string> {
  const timestamp = Date.now().toString();
  const message = `${config.consumerId}\n${timestamp}\n${config.keyVersion}\n`;
  const signature = sign("RSA-SHA256", Buffer.from(message, "utf8"), config.privateKey).toString("base64");

  return {
    "WM_CONSUMER.ID": config.consumerId,
    "WM_CONSUMER.INTIMESTAMP": timestamp,
    "WM_SEC.KEY_VERSION": config.keyVersion,
    "WM_SEC.AUTH_SIGNATURE": signature,
  };
}

interface WalmartItem {
  itemId?: number | string;
  name?: string;
  salePrice?: number;
  brandName?: string;
  categoryPath?: string;
  thumbnailImage?: string;
  mediumImage?: string;
  largeImage?: string;
  productUrl?: string;
  productTrackingUrl?: string;
  customerRating?: string;
  numReviews?: number;
  stock?: string;
  freeShippingOver35Dollars?: boolean;
  sellerInfo?: string;
}

interface WalmartSearchResponse {
  items?: WalmartItem[];
  errors?: { message?: string; code?: string }[];
}

function toAvailability(stock: string | undefined): ProductListing["availability"] {
  if (stock === "Available") return "in_stock";
  if (stock === "Not Available") return "out_of_stock";
  return "unknown";
}

function toListing(item: WalmartItem): ProductListing | null {
  const url = item.productUrl ?? item.productTrackingUrl;
  if (!item.name || !url || typeof item.salePrice !== "number") return null;

  const rating = item.customerRating !== undefined ? Number(item.customerRating) : undefined;

  return {
    id: `walmart:${item.itemId ?? url}`,
    title: item.name,
    marketplace: "walmart",
    price: item.salePrice,
    currency: "USD",
    url,
    image: item.largeImage ?? item.mediumImage ?? item.thumbnailImage,
    brand: item.brandName,
    category: item.categoryPath,
    rating: rating !== undefined && !Number.isNaN(rating) ? rating : undefined,
    reviewCount: item.numReviews,
    seller: item.sellerInfo,
    availability: toAvailability(item.stock),
    shippingInfo: { freeShipping: item.freeShippingOver35Dollars },
    rawData: item,
  };
}

async function getProviderStatus(): Promise<ProviderStatus> {
  return readConfig() !== null ? { connected: true } : { connected: false, reason: NOT_CONNECTED_REASON };
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("walmart", NAME, query, "No search query provided.");

  const config = readConfig();
  if (!config) {
    return unavailableSummary("walmart", NAME, trimmed, NOT_CONNECTED_REASON);
  }

  const url = `${SEARCH_URL}?${new URLSearchParams({
    query: trimmed,
    publisherId: config.publisherId,
    numItems: "10",
  }).toString()}`;

  let data: WalmartSearchResponse;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", ...buildAuthHeaders(config) },
    });
    data = (await res.json().catch(() => ({}))) as WalmartSearchResponse;
    if (!res.ok) {
      const message = data.errors?.[0]?.message ?? `Walmart Affiliate API returned HTTP ${res.status}.`;
      return unavailableSummary("walmart", NAME, trimmed, message);
    }
  } catch (err) {
    return unavailableSummary(
      "walmart",
      NAME,
      trimmed,
      err instanceof Error ? `Walmart search request failed: ${err.message}` : "Walmart search request failed."
    );
  }

  const listings = (data.items ?? []).map(toListing).filter((l): l is ProductListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("walmart", NAME, trimmed, "No live listings found on Walmart for this query.");
  }

  return buildMarketplaceSummary("walmart", NAME, trimmed, listings, { currency: "USD", limit: 10 });
}

export const walmartProvider: MarketplaceProvider = {
  id: "walmart",
  marketplace: "walmart",
  name: NAME,
  isConfigured: () => readConfig() !== null,
  getProviderStatus,
  searchProducts,
};
