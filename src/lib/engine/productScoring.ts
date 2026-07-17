// Scores one real marketplace listing. Every identifying field on the
// result (title, price, image, permalink, ...) is copied straight from the
// listing — this module only ever adds scoring dimensions on top, using
// real, query-level marketplace signal wherever one exists. Dimensions with
// no real-world proxy (bundle potential, supplier availability, repeat
// purchase, trend stability) fall back to the same category-baseline
// heuristic used elsewhere in the engine, seeded off the listing's own
// permalink so they're deterministic per real product rather than random.
import type { MarketplaceId, MarketplaceListing } from "@/lib/marketplace/types";
import { FALLBACK_PROFILE, findCategoryProfile } from "./categoryProfiles";
import { computeOpportunityScore, deriveDimensions, pickRecommendation } from "./heuristicProvider";
import type { DimensionScores, ProductOpportunity } from "./types";

export interface MarketContext {
  marketplace: MarketplaceId;
  marketplaceName: string;
  totalListings: number;
  totalSellers: number;
  priceMin: number;
  priceMax: number;
  currency: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const KNOWN_BRANDS = [
  "apple", "samsung", "sony", "xiaomi", "lg", "hp", "dell", "lenovo", "nike",
  "adidas", "logitech", "microsoft", "huawei", "motorola", "asus", "acer",
  "jbl", "bose", "canon", "nikon", "philips", "whirlpool", "dewalt", "bosch",
];

function detectBrand(title: string): boolean {
  const lower = title.toLowerCase();
  return KNOWN_BRANDS.some((brand) => lower.includes(brand));
}

// Currency-independent, log-scaled so a handful of listings doesn't read as
// "huge demand" but hundreds do — same shape as the query-level adjustment
// used for single-product analysis, applied here per listing since every
// product from the same search shares the same real query-level signal.
function marketplaceSignal(totalListings: number, totalSellers: number): { demand: number; competition: number } {
  return {
    demand: clamp(Math.round(25 + Math.log10(totalListings + 1) * 22), 0, 100),
    competition: clamp(Math.round(15 + Math.log10(totalSellers + 1) * 24), 0, 100),
  };
}

function pricePercentile(price: number, min: number, max: number): number {
  if (max <= min) return 50;
  return clamp(Math.round(((price - min) / (max - min)) * 100), 0, 100);
}

function explainProduct(
  listing: MarketplaceListing,
  market: MarketContext,
  dims: DimensionScores
): string {
  const demandLabel = dims.demand >= 60 ? "strong" : dims.demand >= 40 ? "moderate" : "limited";
  const parts = [
    `${market.totalListings} active listing${market.totalListings === 1 ? "" : "s"} on ${market.marketplaceName} for this search show ${demandLabel} validated demand.`,
  ];
  if (listing.freeShipping) parts.push("Free shipping is already offered, keeping fulfillment simple.");
  if (listing.condition) parts.push(`Listed as ${listing.condition}.`);
  return parts.join(" ");
}

export function scoreMarketplaceProduct(listing: MarketplaceListing, market: MarketContext): ProductOpportunity {
  const profile = findCategoryProfile(listing.title) ?? FALLBACK_PROFILE;
  const seed = listing.url;

  const baseline = deriveDimensions(profile, seed);
  const { demand, competition } = marketplaceSignal(market.totalListings, market.totalSellers);

  const percentile = pricePercentile(listing.price, market.priceMin, market.priceMax);
  const conditionMarginBump = listing.condition === "new" ? 8 : listing.condition === "used" ? -8 : 0;
  const margin = clamp(Math.round(baseline.margin * 0.4 + percentile * 0.6) + conditionMarginBump, 0, 100);

  const shippingComplexity = clamp(
    listing.freeShipping ? Math.round(baseline.shippingComplexity * 0.6) : baseline.shippingComplexity,
    0,
    100
  );

  const branded = detectBrand(listing.title);
  const brandOpportunity = clamp(
    branded ? Math.round(baseline.brandOpportunity * 0.5) : baseline.brandOpportunity,
    0,
    100
  );

  const trustPenalty = (listing.imageUrl ? 0 : 6) + (listing.seller ? 0 : 6);
  const returnRisk = clamp(
    baseline.returnRisk + (listing.condition === "used" ? 10 : 0) + trustPenalty,
    0,
    100
  );

  const dimensions: DimensionScores = {
    ...baseline,
    demand,
    competition,
    margin,
    shippingComplexity,
    brandOpportunity,
    returnRisk,
  };

  const opportunityScore = computeOpportunityScore(profile, dimensions);

  return {
    title: listing.title,
    category: profile.category,
    marketplace: market.marketplace,
    marketplaceName: market.marketplaceName,
    price: listing.price,
    currency: listing.currency || market.currency,
    imageUrl: listing.imageUrl,
    permalink: listing.url,
    seller: listing.seller,
    condition: listing.condition,
    location: listing.location,
    freeShipping: listing.freeShipping,
    opportunityScore,
    recommendation: pickRecommendation(opportunityScore),
    dimensions,
    shortExplanation: explainProduct(listing, market, dimensions),
    dataConfidence: "hybrid",
  };
}
