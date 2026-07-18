import { createHash, createHmac } from "node:crypto";
import type { MarketplaceProvider, MarketplaceSummary, ProductListing, ProviderStatus } from "../types";
import { unavailableSummary } from "../types";
import { buildMarketplaceSummary } from "../aggregate";

// Amazon Product Advertising API (PA-API 5.0) client — the official API
// only, no scraping. Requires an Associates account with qualifying sales
// plus these credentials. Until configured, `search` returns an
// `available: false` "Not Connected" summary without ever hitting the
// network, so the rest of the app is unaffected.
const NAME = "Amazon";
const SERVICE = "ProductAdvertisingAPI";
const TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const FETCH_TIMEOUT_MS = 8000;

interface AmazonConfig {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  host: string;
  region: string;
  marketplace: string;
}

function readConfig(): AmazonConfig | null {
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  if (!accessKey || !secretKey || !partnerTag) return null;

  return {
    accessKey,
    secretKey,
    partnerTag,
    host: process.env.AMAZON_HOST || "webservices.amazon.com",
    region: process.env.AMAZON_REGION || "us-east-1",
    marketplace: process.env.AMAZON_MARKETPLACE || "www.amazon.com",
  };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function hash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

// Manual AWS SigV4 signing (no AWS SDK dependency) for the single POST
// request PA-API's SearchItems operation requires.
function signRequest(config: AmazonConfig, path: string, payload: string) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${config.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${TARGET}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    hash(payload),
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${config.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { amzDate, authorization };
}

interface PaapiListingPrice {
  Amount?: number;
  Currency?: string;
}

interface PaapiItem {
  DetailPageURL?: string;
  ItemInfo?: { Title?: { DisplayValue?: string }; ByLineInfo?: { Brand?: { DisplayValue?: string } } };
  Images?: { Primary?: { Medium?: { URL?: string } } };
  Offers?: { Listings?: { Price?: PaapiListingPrice; Condition?: { Value?: string } }[] };
  CustomerReviews?: { StarRating?: { Value?: number }; Count?: number };
}

interface PaapiSearchResponse {
  SearchResult?: { Items?: PaapiItem[]; TotalResultCount?: number };
  Errors?: { Message?: string }[];
}

function toListing(item: PaapiItem): ProductListing | null {
  const title = item.ItemInfo?.Title?.DisplayValue;
  const url = item.DetailPageURL;
  const price = item.Offers?.Listings?.[0]?.Price?.Amount;
  if (!title || !url || typeof price !== "number") return null;

  return {
    id: `amazon:${url}`,
    title,
    marketplace: "amazon",
    price,
    currency: item.Offers?.Listings?.[0]?.Price?.Currency ?? "USD",
    url,
    image: item.Images?.Primary?.Medium?.URL,
    brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
    condition: item.Offers?.Listings?.[0]?.Condition?.Value,
    rating: item.CustomerReviews?.StarRating?.Value,
    reviewCount: item.CustomerReviews?.Count,
    rawData: item,
  };
}

const NOT_CONNECTED_REASON =
  "Amazon Product Advertising API is not connected. Add AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, and AMAZON_PARTNER_TAG to enable live Amazon data.";

async function getProviderStatus(): Promise<ProviderStatus> {
  return readConfig() !== null ? { connected: true } : { connected: false, reason: NOT_CONNECTED_REASON };
}

async function searchProducts(query: string): Promise<MarketplaceSummary> {
  const trimmed = query.trim();
  if (!trimmed) return unavailableSummary("amazon", NAME, query, "No search query provided.");

  const config = readConfig();
  if (!config) {
    return unavailableSummary("amazon", NAME, trimmed, NOT_CONNECTED_REASON);
  }

  const path = "/paapi5/searchitems";
  const body = {
    Keywords: trimmed,
    PartnerTag: config.partnerTag,
    PartnerType: "Associates",
    Marketplace: config.marketplace,
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.ByLineInfo",
      "Offers.Listings.Price",
      "Offers.Listings.Condition",
      "Images.Primary.Medium",
      "CustomerReviews.StarRating",
      "CustomerReviews.Count",
    ],
  };
  const payload = JSON.stringify(body);
  const { amzDate, authorization } = signRequest(config, path, payload);

  let data: PaapiSearchResponse;
  try {
    const res = await fetch(`https://${config.host}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "content-encoding": "amz-1.0",
        "content-type": "application/json; charset=utf-8",
        host: config.host,
        "x-amz-date": amzDate,
        "x-amz-target": TARGET,
        authorization,
      },
      body: payload,
    });
    data = (await res.json()) as PaapiSearchResponse;
    if (!res.ok) {
      const message = data.Errors?.[0]?.Message ?? `Amazon PA-API returned ${res.status}.`;
      return unavailableSummary("amazon", NAME, trimmed, message);
    }
  } catch (err) {
    return unavailableSummary(
      "amazon",
      NAME,
      trimmed,
      err instanceof Error ? err.message : "Amazon PA-API request failed."
    );
  }

  const listings = (data.SearchResult?.Items ?? [])
    .map(toListing)
    .filter((l): l is ProductListing => l !== null);

  if (listings.length === 0) {
    return unavailableSummary("amazon", NAME, trimmed, "No live listings found on Amazon for this query.");
  }

  return buildMarketplaceSummary("amazon", NAME, trimmed, listings, { currency: listings[0].currency, limit: 10 });
}

export const amazonProvider: MarketplaceProvider = {
  id: "amazon-paapi",
  marketplace: "amazon",
  name: NAME,
  isConfigured: () => readConfig() !== null,
  getProviderStatus,
  searchProducts,
};
