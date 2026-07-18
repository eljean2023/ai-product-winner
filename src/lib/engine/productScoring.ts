// Scores one real marketplace listing. Every identifying field on the
// result (title, price, image, permalink, ...) is copied straight from the
// listing — this module only ever adds scoring dimensions on top, using
// real, per-listing signal (rating, review count, price, rank) wherever one
// exists so that two different real products from the same search score
// differently instead of inheriting one identical market-wide number.
// Dimensions with no real-world proxy (bundle potential, supplier
// availability, repeat purchase, trend stability) fall back to the same
// category-baseline heuristic used elsewhere in the engine, seeded off the
// listing's own permalink so they're deterministic per real product rather
// than random.
import type { MarketplaceId, MarketplaceListing } from "@/lib/marketplace/types";
import { FALLBACK_PROFILE, findCategoryProfile } from "./categoryProfiles";
import { computeOpportunityScore, deriveDimensions } from "./heuristicProvider";
import { detectBrand, findBrand } from "./brands";
import { computeRecommendation } from "./opportunityInsights";
import {
  applyBrandAdjustment,
  clamp,
  computeMarketSaturation,
  logScale,
  priceBandBonus,
  ratingReturnPenalty,
  reviewDemandSignal,
} from "./scoringUtils";
import { generateSellingAngle } from "./sellingAngle";
import type { DataSource, DimensionKey, DimensionScores, ProductOpportunity } from "./types";

export interface MarketContext {
  marketplace: MarketplaceId;
  marketplaceName: string;
  totalListings: number;
  totalSellers: number;
  priceMin: number;
  priceMax: number;
  averagePrice?: number;
  // Average rating across the competing listings in this market — a highly
  // rated competing set is harder to unseat than the same seller count with
  // mediocre ratings, so this nudges competition beyond a pure headcount.
  averageRating?: number;
  // Fraction (0-1) of this market's listings dominated by each brand,
  // keyed by lowercase brand name — lets brand-penalty severity scale with
  // how much of the actual market that brand controls instead of a flat
  // penalty regardless of concentration.
  brandConcentration?: Record<string, number>;
  currency: string;
}

function pricePercentile(price: number, min: number, max: number): number {
  if (max <= min) return 50;
  return clamp(Math.round(((price - min) / (max - min)) * 100), 0, 100);
}

function explainProduct(
  listing: MarketplaceListing,
  market: MarketContext,
  dims: DimensionScores,
  branded: boolean,
  sellingAngle: string
): string {
  const demandLabel = dims.demand >= 60 ? "strong" : dims.demand >= 40 ? "moderate" : "limited";
  const parts = [
    `${market.totalListings} active listing${market.totalListings === 1 ? "" : "s"} on ${market.marketplaceName} for this search show ${demandLabel} validated demand.`,
  ];
  if (listing.rating !== undefined && listing.reviewCount !== undefined) {
    parts.push(`Rated ${listing.rating} from ${listing.reviewCount} reviews.`);
  }
  if (branded) {
    const brandName = findBrand(listing.title);
    parts.push(`Dominated by ${brandName} — limited brand-building room here.`);
  }
  if (listing.freeShipping) parts.push("Free shipping is already offered, keeping fulfillment simple.");
  if (listing.condition) parts.push(`Listed as ${listing.condition}.`);
  parts.push(sellingAngle);
  return parts.join(" ");
}

export function scoreMarketplaceProduct(
  listing: MarketplaceListing,
  market: MarketContext,
  rank = 0
): ProductOpportunity {
  const profile = findCategoryProfile(listing.title) ?? FALLBACK_PROFILE;
  const seed = listing.url;

  const baseline = deriveDimensions(profile, seed);

  // Demand blends the market-wide signal (how many listings answer this
  // search at all) with this listing's own proven demand — its review
  // count and rating — plus a small nudge for how early it ranked in real
  // search results. This is what makes two different products from the
  // same search actually diverge instead of both inheriting one shared
  // market-level demand number.
  const marketDemand = logScale(market.totalListings, 25, 22);
  const perListingDemand = reviewDemandSignal(listing.reviewCount, listing.rating);
  const rankBonus = clamp(6 - rank, -6, 6);
  const demand =
    perListingDemand !== null
      ? clamp(Math.round(marketDemand * 0.4 + perListingDemand * 0.5 + rankBonus), 0, 100)
      : clamp(marketDemand + rankBonus, 0, 100);

  // Pure headcount, nudged by competing-set quality: a competing set that's
  // rated very highly is harder for a new seller to unseat than the same
  // seller count with mediocre ratings; a poorly rated set is more beatable
  // even at higher volume.
  const competitionHeadcount = logScale(market.totalSellers, 15, 24);
  const competitionQualityAdjustment =
    market.averageRating !== undefined ? clamp(Math.round((market.averageRating - 4) * 8), -12, 12) : 0;
  const competition = clamp(competitionHeadcount + competitionQualityAdjustment, 0, 100);

  const marketSaturation = computeMarketSaturation(
    market.totalListings,
    market.priceMin,
    market.priceMax,
    market.averagePrice
  );

  const percentile = pricePercentile(listing.price, market.priceMin, market.priceMax);
  const conditionMarginBump = listing.condition === "new" ? 8 : listing.condition === "used" ? -8 : 0;
  const currency = listing.currency || market.currency;
  const margin = clamp(
    Math.round(baseline.margin * 0.4 + percentile * 0.6) + conditionMarginBump + priceBandBonus(listing.price, currency),
    0,
    100
  );

  const shippingComplexity = clamp(
    listing.freeShipping ? Math.round(baseline.shippingComplexity * 0.6) : baseline.shippingComplexity,
    0,
    100
  );

  const trustPenalty = (listing.imageUrl ? 0 : 6) + (listing.seller ? 0 : 6);
  const returnRisk = clamp(
    baseline.returnRisk + (listing.condition === "used" ? 10 : 0) + trustPenalty + ratingReturnPenalty(listing.rating),
    0,
    100
  );

  const branded = detectBrand(listing.title);
  const brandName = branded ? findBrand(listing.title) : null;
  const brandConcentration = brandName ? market.brandConcentration?.[brandName.toLowerCase()] : undefined;
  const dimensions: DimensionScores = applyBrandAdjustment(
    {
      ...baseline,
      demand,
      competition,
      margin,
      shippingComplexity,
      returnRisk,
      marketSaturation,
    },
    branded,
    brandConcentration
  );

  const opportunityScore = computeOpportunityScore(profile, dimensions);
  const sellingAngle = generateSellingAngle(listing.title, profile.category, branded, dimensions.margin, seed);

  const dimensionSources: Partial<Record<DimensionKey, DataSource>> = {
    demand: perListingDemand !== null ? "real" : "ai-estimate",
    competition: "real",
    marketSaturation: "real",
    margin: "real",
    shippingComplexity: "real",
    returnRisk: "real",
    brandOpportunity: "heuristic",
    bundlePotential: "ai-estimate",
    supplierAvailability: "ai-estimate",
    repeatPurchase: "ai-estimate",
    trendStability: "ai-estimate",
  };

  return {
    title: listing.title,
    category: profile.category,
    marketplace: market.marketplace,
    marketplaceName: market.marketplaceName,
    price: listing.price,
    currency,
    imageUrl: listing.imageUrl,
    permalink: listing.url,
    seller: listing.seller,
    condition: listing.condition,
    location: listing.location,
    freeShipping: listing.freeShipping,
    opportunityScore,
    recommendation: computeRecommendation({ opportunityScore, dimensions }),
    dimensions,
    dimensionSources,
    shortExplanation: explainProduct(listing, market, dimensions, branded, sellingAngle),
    sellingAngle,
    dataConfidence: "hybrid",
  };
}
