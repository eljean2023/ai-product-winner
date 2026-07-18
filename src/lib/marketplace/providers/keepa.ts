import type { HistoricalIntelligenceProvider, ProductHistory, ProductHistoryPoint, ProviderStatus } from "../types";

// Keepa's historical intelligence API — price history, sales rank, and
// trend/demand validation over time for an already-known Amazon ASIN. This
// is deliberately not a MarketplaceProvider (see HistoricalIntelligenceProvider
// in ../types): Keepa doesn't do query search, it enriches a listing the
// app already found by ASIN, so it's never registered in registry.ts and
// never touches searchAllMarketplaces.
//
// `getProductHistory(id)` expects `id` to be a bare Amazon ASIN (e.g.
// "B08N5WRWNW"), not a ProductListing.id (which is a `amazon:<url>` string)
// — Keepa itself is keyed by ASIN, so callers are expected to extract one
// from an Amazon listing's URL before calling this provider.
const NAME = "Keepa";
const PRODUCT_URL = "https://api.keepa.com/product";
const FETCH_TIMEOUT_MS = 10_000;

// Keepa's own CSV-type indices (see https://keepa.com/#!discuss/t/product-object/116,
// "csv" field, and Keepa's own Product.CsvType enum ordering at
// github.com/keepacom/api_backend) — the series this provider surfaces.
const CSV_INDEX_AMAZON_PRICE = 0;
const CSV_INDEX_NEW_PRICE = 1; // 3rd-party "New" price — fallback when Amazon itself never held the buy box
const CSV_INDEX_SALES_RANK = 3;
const CSV_INDEX_COUNT_NEW = 11; // active "New" offer count — closest verifiable stock/supply-continuity proxy
const CSV_INDEX_RATING = 16; // Keepa encodes this as rating*10 (e.g. 45 = 4.5 stars); requires rating=1 on the request
const CSV_INDEX_COUNT_REVIEWS = 17; // requires rating=1 on the request
const CSV_INDEX_BUY_BOX_SHIPPING = 18; // requires buybox=1 on the request; -1 = no offer currently qualifies

// "Keepa Time" is minutes since 2011-01-01T00:00:00Z; this is the fixed
// offset (in minutes) Keepa documents for converting it to a Unix
// timestamp. -1 in any csv value means "no data at this point" and must be
// skipped, never treated as a real price/rank of -1.
const KEEPA_EPOCH_OFFSET_MINUTES = 21_564_000;

function keepaMinutesToIso(keepaMinutes: number): string {
  return new Date((keepaMinutes + KEEPA_EPOCH_OFFSET_MINUTES) * 60_000).toISOString();
}

interface KeepaConfig {
  apiKey: string;
  domain: string;
}

function readConfig(): KeepaConfig | null {
  const apiKey = process.env.KEEPA_API_KEY;
  if (!apiKey) return null;
  return { apiKey, domain: process.env.KEEPA_DOMAIN || "1" };
}

const NOT_CONNECTED_REASON = "Keepa is not connected. Add KEEPA_API_KEY to enable historical price/sales-rank data.";

async function getProviderStatus(): Promise<ProviderStatus> {
  return readConfig() !== null ? { connected: true } : { connected: false, reason: NOT_CONNECTED_REASON };
}

interface KeepaProduct {
  asin?: string;
  csv?: (number[] | null)[];
}

interface KeepaProductResponse {
  products?: KeepaProduct[];
  error?: { message?: string };
}

type SeriesField = keyof Omit<ProductHistoryPoint, "timestamp">;

// Keepa prices/costs are in cents; ratings are encoded as rating*10 (45 =
// 4.5 stars); counts (sales rank, review count, offer count) are raw
// integers. -1 in any csv value means "no data at this point" (or, for Buy
// Box, "no offer currently qualifies") and must be skipped, never treated as
// a real value of -1.
function decodeSeries(
  csv: number[] | null | undefined,
  field: SeriesField,
  transform: (raw: number) => number = (raw) => raw
): ProductHistoryPoint[] {
  if (!csv) return [];
  const points: ProductHistoryPoint[] = [];
  for (let i = 0; i + 1 < csv.length; i += 2) {
    const time = csv[i];
    const value = csv[i + 1];
    if (value === -1 || value === undefined) continue;
    points.push({ timestamp: keepaMinutesToIso(time), [field]: transform(value) } as ProductHistoryPoint);
  }
  return points;
}

const toDollars = (cents: number) => Math.round(cents) / 100;
const toStars = (tenths: number) => Math.round(tenths) / 10;

// Keepa's csv arrays can span a product's entire multi-year lifetime —
// bounded to the most recent points so a single lookup stays a reasonable
// size for callers to render/reason about. Raised from the original 300 to
// accommodate the additional series (rating, reviews, Buy Box, offer count)
// now merged into the same timeline.
const MAX_HISTORY_POINTS = 600;

async function getProductHistory(asin: string): Promise<ProductHistory | null> {
  const config = readConfig();
  if (!config) return null;

  const trimmed = asin.trim();
  if (!trimmed) return null;

  const url = `${PRODUCT_URL}?${new URLSearchParams({
    key: config.apiKey,
    domain: config.domain,
    asin: trimmed,
    history: "1",
    stats: "0",
    // Keepa only includes the RATING/COUNT_REVIEWS csv series when `rating`
    // is set, and BUY_BOX_SHIPPING only when `buybox` is set — the base
    // AMAZON/NEW/SALES/COUNT_NEW series are already included by `history`.
    rating: "1",
    buybox: "1",
  }).toString()}`;

  let data: KeepaProductResponse;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    data = (await res.json().catch(() => ({}))) as KeepaProductResponse;
    if (!res.ok || data.error) {
      return null;
    }
  } catch {
    return null;
  }

  const product = data.products?.[0];
  if (!product) return null;

  // Prefer Amazon-as-seller price history; fall back to 3rd-party "New"
  // price when Amazon itself never held a price point for this ASIN (common
  // for marketplace-only listings) rather than reporting no price data at
  // all for those products.
  const amazonPricePoints = decodeSeries(product.csv?.[CSV_INDEX_AMAZON_PRICE], "price", toDollars);
  const pricePoints =
    amazonPricePoints.length > 0
      ? amazonPricePoints
      : decodeSeries(product.csv?.[CSV_INDEX_NEW_PRICE], "price", toDollars);
  const rankPoints = decodeSeries(product.csv?.[CSV_INDEX_SALES_RANK], "salesRank");
  const ratingPoints = decodeSeries(product.csv?.[CSV_INDEX_RATING], "rating", toStars);
  const reviewCountPoints = decodeSeries(product.csv?.[CSV_INDEX_COUNT_REVIEWS], "reviewCount");
  const buyBoxPoints = decodeSeries(product.csv?.[CSV_INDEX_BUY_BOX_SHIPPING], "buyBoxPrice", toDollars);
  const offerCountPoints = decodeSeries(product.csv?.[CSV_INDEX_COUNT_NEW], "offerCountNew");

  const points = [...pricePoints, ...rankPoints, ...ratingPoints, ...reviewCountPoints, ...buyBoxPoints, ...offerCountPoints]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-MAX_HISTORY_POINTS);

  if (points.length === 0) return null;

  return { id: product.asin ?? trimmed, marketplace: "amazon", points };
}

export const keepaProvider: HistoricalIntelligenceProvider = {
  id: "keepa",
  name: NAME,
  getProviderStatus,
  getProductHistory,
};
