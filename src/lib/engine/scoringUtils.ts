// Shared math for blending real marketplace signals (listing counts, seller
// counts, prices, ratings, review counts) into the category-baseline scores.
// Every function here only ever consumes fields that already exist on
// MarketplaceListing/MarketplaceSummary — nothing here invents data, it only
// reshapes real numbers into 0-100 dimension scores.
import type { DimensionScores } from "./types";

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
  const ratingBonus = rating !== undefined ? clamp(Math.round((rating - 3) * 15), -30, 30) : 0;
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
export function applyBrandAdjustment(dims: DimensionScores, branded: boolean): DimensionScores {
  if (branded) {
    return {
      ...dims,
      brandOpportunity: clamp(Math.round(dims.brandOpportunity * 0.15), 3, 20),
      competition: clamp(dims.competition + 20, 0, 100),
    };
  }
  return {
    ...dims,
    brandOpportunity: clamp(Math.round(dims.brandOpportunity * 1.1 + 15), 55, 95),
  };
}
