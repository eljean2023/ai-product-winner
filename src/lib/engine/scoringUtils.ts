// Shared math for blending real marketplace signals (listing counts, seller
// counts, prices, ratings, review counts) into the category-baseline scores.
// Every function here only ever consumes fields that already exist on
// ProductListing/MarketplaceSummary — nothing here invents data, it only
// reshapes real numbers into 0-100 dimension scores.
import type { DataSource, DimensionKey, DimensionScores } from "./types";

// The heuristic-only path (no marketplace match at all) has no real data
// for any dimension — every score is a category-baseline estimate — except
// brand opportunity, which is always a deterministic keyword rule regardless
// of whether real listings are available.
export const HEURISTIC_ONLY_SOURCES: Record<DimensionKey, DataSource> = {
  demand: "ai-estimate",
  competition: "ai-estimate",
  margin: "ai-estimate",
  shippingComplexity: "ai-estimate",
  supplierAvailability: "ai-estimate",
  bundlePotential: "ai-estimate",
  brandOpportunity: "heuristic",
  repeatPurchase: "ai-estimate",
  trendStability: "ai-estimate",
  returnRisk: "ai-estimate",
  marketSaturation: "ai-estimate",
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Log-scaled so a handful of listings/sellers/reviews doesn't read as huge,
// but hundreds/thousands do. Same shape used everywhere a raw count needs to
// become a 0-100 signal.
export function logScale(count: number, base: number, spread: number): number {
  return clamp(Math.round(base + Math.log10(Math.max(count, 0) + 1) * spread), 0, 100);
}

// Real per-listing review/rating signal. Two listings from the same search
// share the same market-level demand baseline, but a listing with 8,000
// reviews at 4.6 stars has proven demand a listing with 12 reviews hasn't —
// this is what actually differentiates "demand" between products in the
// same result set instead of every product reading identically.
export function reviewDemandSignal(reviewCount: number | undefined, rating: number | undefined): number | null {
  if (reviewCount === undefined) return null;
  const volume = logScale(reviewCount, 20, 18);
  // A rating backed by only a handful of reviews is far less trustworthy
  // than the same rating backed by hundreds — dampen the rating's swing by
  // review-count confidence instead of trusting a 5.0-from-2-reviews as much
  // as a 4.6-from-5,000.
  const confidenceFactor = clamp(reviewCount / 100, 0.3, 1);
  const ratingBonus = rating !== undefined ? clamp(Math.round((rating - 3) * 15 * confidenceFactor), -30, 30) : 0;
  return clamp(volume + ratingBonus, 0, 100);
}

// A low rating is itself a real, forward-looking return-risk signal —
// distinct from the condition/trust penalties already applied elsewhere.
export function ratingReturnPenalty(rating: number | undefined): number {
  if (rating === undefined) return 0;
  return clamp(Math.round((4 - rating) * 12), -20, 40);
}

// Thousands of near-identical, tightly price-clustered listings signal a
// saturated, race-to-the-bottom market; a smaller pool with a wider price
// spread signals a less-saturated, more differentiated niche.
export function computeMarketSaturation(
  totalListings: number,
  priceMin?: number,
  priceMax?: number,
  averagePrice?: number
): number {
  const volumeSignal = logScale(totalListings, 15, 28);
  if (priceMin === undefined || priceMax === undefined || !averagePrice) {
    return volumeSignal;
  }
  const relativeSpread = averagePrice > 0 ? (priceMax - priceMin) / averagePrice : 1;
  const clusterSignal = clamp(Math.round(100 - relativeSpread * 60), 0, 100);
  return clamp(Math.round(volumeSignal * 0.65 + clusterSignal * 0.35), 0, 100);
}

// $20-$80 is the sweet spot for a new seller: enough margin to absorb
// marketplace fees and ad spend without the higher capital outlay and
// return risk of premium/high-cost-electronics price points. USD-only —
// comparing a foreign-currency price against a USD band would misinform
// rather than help, same guard used elsewhere for margin-from-price logic.
export function priceBandBonus(price: number, currency: string): number {
  if (currency !== "USD") return 0;
  if (price >= 20 && price <= 80) return 12;
  if (price < 8 || price > 150) return -12;
  return 0;
}

// A recognized, established brand (Apple, Samsung, Sony, Nike, ...) crowds
// out brand-building room for a new seller on that exact listing and
// signals a more entrenched, higher-competition market; the absence of one
// is itself a private-label opportunity signal. Mirrors the spec examples:
// "Apple AirPods" ~10/100 brand opportunity, generic earbuds ~80/100.
// `concentration` is the fraction (0-1) of the competing market's listings
// that belong to the same detected brand — a market that's 90% one brand
// deserves a harsher penalty than one where the brand shows up once. Callers
// with no listing set to measure against (the query-only heuristic path)
// omit it and get the original flat adjustment via the 0.5 default.
export function applyBrandAdjustment(
  dims: DimensionScores,
  branded: boolean,
  concentration = 0.5
): DimensionScores {
  if (branded) {
    const intensity = clamp(concentration, 0, 1);
    const brandCeiling = clamp(Math.round(20 - (intensity - 0.5) * 10), 15, 25);
    const competitionBonus = clamp(Math.round(20 + (intensity - 0.5) * 12), 14, 26);
    return {
      ...dims,
      brandOpportunity: clamp(Math.round(dims.brandOpportunity * 0.15), 3, brandCeiling),
      competition: clamp(dims.competition + competitionBonus, 0, 100),
    };
  }
  return {
    ...dims,
    brandOpportunity: clamp(Math.round(dims.brandOpportunity * 1.1 + 15), 55, 95),
  };
}
