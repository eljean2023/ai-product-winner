// The hybrid layer: takes the pure heuristic engine's output and blends in
// real marketplace data. For *search* data this is the only file in the
// engine that knows marketplace data exists at all — it talks to the
// marketplace layer only through `searchAllMarketplaces`, never a specific
// MarketplaceProvider, so the engine stays completely provider-independent:
// the direct Amazon PA-API, eBay Browse API, Mercado Libre, and Walmart
// Affiliate API are each just a MarketplaceProvider entry — none of them is
// architected around, and any of them can be added, replaced, or removed in
// @/lib/marketplace/registry without a single line changing here. (SerpAPI
// is implemented but disabled — not part of the active registry.)
//
// Keepa is the one deliberate exception, imported directly rather than
// through the registry — see HistoricalIntelligenceProvider in
// @/lib/marketplace/types and the comment atop providers/keepa.ts: it isn't
// a search provider (it's keyed by ASIN, not a query), so it was never meant
// to go through searchAllMarketplaces/registry.ts in the first place. This
// is that documented integration point, not a break from provider
// independence.
import { marketplaceProviders, searchAllMarketplaces } from "@/lib/marketplace/registry";
import { keepaProvider } from "@/lib/marketplace/providers/keepa";
import type { MarketplaceSummary, ProductListing } from "@/lib/marketplace/types";
import { findBrand } from "./brands";
import { getCategoryProfileByName } from "./categoryProfiles";
import { analyzeProduct as heuristicAnalyze, computeOpportunityScore } from "./heuristicProvider";
import { analyzeHistory, applyHistoricalSignals } from "./historicalIntelligence";
import { computeRecommendation } from "./opportunityInsights";
import { scoreMarketplaceProduct } from "./productScoring";
import type { MarketContext } from "./productScoring";
import { clamp, computeMarketSaturation } from "./scoringUtils";
import type {
  AnalysisResult,
  DataConfidence,
  DimensionKey,
  DataSource,
  DiscoveryResult,
  EngineOptions,
  MarketIntelligenceProvider,
} from "./types";

// Amazon PA-API DetailPageURLs look like .../dp/B08N5WRWNW or
// .../gp/product/B08N5WRWNW(/...); Keepa is keyed by the bare 10-character
// ASIN. Returns null (never throws/guesses) for any URL shape that doesn't
// match, so callers skip Keepa enrichment cleanly instead of querying it
// with a wrong id.
function extractAsin(url: string): string | null {
  const match = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

// A market with no seller count reported by the provider falls back to
// listing count, but one seller commonly lists several items — dampening
// the estimate keeps competition from reading higher than it likely is.
function estimateSellerCount(listingCount: number, sellerCount?: number): number {
  return sellerCount ?? Math.max(1, Math.round(listingCount * 0.6));
}

// Fraction (0-1) of a market's listings dominated by each detected brand,
// keyed by lowercase brand name — used to scale brand-penalty severity by
// how much of the actual market that brand controls.
function computeBrandConcentration(listings: ProductListing[]): Record<string, number> {
  if (listings.length === 0) return {};
  const counts = new Map<string, number>();
  for (const listing of listings) {
    const brand = findBrand(listing.title);
    if (!brand) continue;
    const key = brand.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shares: Record<string, number> = {};
  counts.forEach((count, key) => {
    shares[key] = count / listings.length;
  });
  return shares;
}

// Prefer the first available marketplace in registry priority order (see
// marketplaceProviders in registry.ts) as the primary real price band.
// Never mixes currencies from two different marketplaces into one min/max
// band. No marketplace is hardcoded here — priority is entirely a property
// of registration order, so it never blocks on any one provider.
function pickPrimarySummary(summaries: MarketplaceSummary[]): MarketplaceSummary | undefined {
  return summaries.find((s) => s.available);
}

interface MarketplaceAdjustment {
  demandFromData: number;
  competitionFromData: number;
  marginFromData?: number;
  marketSaturationFromData: number;
  marketplaceScore: number;
  primary?: MarketplaceSummary;
}

function computeAdjustment(base: AnalysisResult, summaries: MarketplaceSummary[]): MarketplaceAdjustment | null {
  const available = summaries.filter((s) => s.available);
  if (available.length === 0) return null;

  const totalListings = available.reduce((sum, s) => sum + s.listingCount, 0);
  const totalSellers = available.reduce((sum, s) => sum + estimateSellerCount(s.listingCount, s.sellerCount), 0);

  // Log-scaled so a handful of listings doesn't read as "huge demand" but
  // hundreds do — deliberately currency-independent (counts only).
  const demandFromData = clamp(Math.round(25 + Math.log10(totalListings + 1) * 22), 0, 100);
  const competitionFromData = clamp(Math.round(15 + Math.log10(totalSellers + 1) * 24), 0, 100);

  const primary = pickPrimarySummary(summaries);
  let marginFromData: number | undefined;

  // Comparing a real price to the category's heuristic price band only
  // makes sense in the same currency the band was designed around (USD).
  // Rather than guess an FX rate, skip the margin nudge entirely for
  // non-USD primaries instead of risking a misleading signal.
  if (primary?.averagePrice !== undefined && primary.currency === "USD") {
    const profile = getCategoryProfileByName(base.category);
    const span = profile.priceCeiling - profile.priceFloor || 1;
    const relativePosition = clamp((primary.averagePrice - profile.priceFloor) / span, 0, 1);
    marginFromData = clamp(Math.round(30 + relativePosition * 50), 0, 100);
  }

  const marketSaturationFromData = computeMarketSaturation(
    totalListings,
    primary?.minPrice,
    primary?.maxPrice,
    primary?.averagePrice
  );

  const marketplaceScore = Math.round(
    demandFromData * 0.3 +
      (100 - competitionFromData) * 0.25 +
      (marginFromData ?? base.dimensions.margin) * 0.2 +
      (100 - marketSaturationFromData) * 0.25
  );

  return { demandFromData, competitionFromData, marginFromData, marketSaturationFromData, marketplaceScore, primary };
}

function buildMarketplaceNotes(summaries: MarketplaceSummary[]): { positives: string[]; risks: string[] } {
  const positives: string[] = [];
  const risks: string[] = [];

  for (const summary of summaries) {
    if (!summary.available) {
      risks.push(
        summary.reason
          ? `${summary.marketplaceName}: ${summary.reason}`
          : `${summary.marketplaceName} data is currently unavailable.`
      );
      continue;
    }

    const priceText =
      summary.averagePrice !== undefined
        ? ` averaging ${summary.averagePrice} ${summary.currency ?? ""}`.trimEnd()
        : "";

    if (summary.listingCount < 5) {
      risks.push(
        `Only ${summary.listingCount} active listing${summary.listingCount === 1 ? "" : "s"} found on ${summary.marketplaceName} — limited real-world validation yet.`
      );
    } else {
      positives.push(
        `${summary.listingCount} active listings on ${summary.marketplaceName}${priceText} — validated demand signal from live marketplace data.`
      );
    }
  }

  return { positives, risks };
}

function withMarketplaceData(base: AnalysisResult, summaries: MarketplaceSummary[]): AnalysisResult {
  const adjustment = computeAdjustment(base, summaries);
  const notes = buildMarketplaceNotes(summaries);

  if (!adjustment) {
    return {
      ...base,
      marketplaceData: summaries,
      dataConfidence: "heuristic-only" as DataConfidence,
      positives: [...base.positives, ...notes.positives].slice(0, 8),
      risks: [...base.risks, ...notes.risks].slice(0, 6),
    };
  }

  const dimensions = {
    ...base.dimensions,
    demand: Math.round(base.dimensions.demand * 0.6 + adjustment.demandFromData * 0.4),
    competition: Math.round(base.dimensions.competition * 0.6 + adjustment.competitionFromData * 0.4),
    margin:
      adjustment.marginFromData !== undefined
        ? Math.round(base.dimensions.margin * 0.7 + adjustment.marginFromData * 0.3)
        : base.dimensions.margin,
    marketSaturation: Math.round(base.dimensions.marketSaturation * 0.6 + adjustment.marketSaturationFromData * 0.4),
  };

  const opportunityScore = Math.round(base.opportunityScore * 0.6 + adjustment.marketplaceScore * 0.4);
  const primary = adjustment.primary;

  // Real marketplace numbers now back these dimensions, upgraded from the
  // heuristic-only baseline's "ai-estimate" sourcing; margin only upgrades
  // when a real price band actually contributed to it (see marginFromData).
  const dimensionSources: Partial<Record<DimensionKey, DataSource>> = {
    ...base.dimensionSources,
    demand: "real",
    competition: "real",
    marketSaturation: "real",
    ...(adjustment.marginFromData !== undefined ? { margin: "real" as const } : {}),
  };

  return {
    ...base,
    dimensions,
    dimensionSources,
    demand: dimensions.demand,
    competition: dimensions.competition,
    marginPotential: dimensions.margin,
    opportunityScore,
    recommendation: computeRecommendation({ opportunityScore, dimensions }),
    priceMin: primary?.minPrice ?? base.priceMin,
    priceMax: primary?.maxPrice ?? base.priceMax,
    priceCurrency: primary?.currency ?? base.priceCurrency,
    marketplaceData: summaries,
    dataConfidence: "hybrid" as DataConfidence,
    positives: [...base.positives, ...notes.positives].slice(0, 8),
    risks: [...base.risks, ...notes.risks].slice(0, 6),
  };
}

// Best-effort Keepa enrichment layered on top of an already-computed hybrid
// result. Never blocks or fails the main flow (a Keepa error/timeout just
// means no historical signal, same as any other optional data source in
// this codebase) and never touches the opportunity-score formula or the
// recommendation thresholds themselves — it only nudges dimension inputs
// (via applyHistoricalSignals) and then re-runs the exact same, unchanged
// computeOpportunityScore/computeRecommendation functions every other path
// already uses.
async function withHistoricalIntelligence(
  result: AnalysisResult,
  summaries: MarketplaceSummary[]
): Promise<AnalysisResult> {
  const amazonSummary = summaries.find((s) => s.marketplace === "amazon" && s.available);
  const asin = amazonSummary?.topListing ? extractAsin(amazonSummary.topListing.url) : null;
  if (!asin) return result;

  const history = await keepaProvider.getProductHistory(asin).catch(() => null);
  const signals = analyzeHistory(history);
  const blend = applyHistoricalSignals(result.dimensions, result.dimensionSources, signals);

  const profile = getCategoryProfileByName(result.category);
  const opportunityScore = computeOpportunityScore(profile, blend.dimensions);
  const recommendation = computeRecommendation({ opportunityScore, dimensions: blend.dimensions });

  return {
    ...result,
    dimensions: blend.dimensions,
    dimensionSources: blend.sources,
    demand: blend.dimensions.demand,
    competition: blend.dimensions.competition,
    marginPotential: blend.dimensions.margin,
    opportunityScore,
    recommendation,
    positives: blend.notes.length > 0 ? [...result.positives, ...blend.notes].slice(0, 8) : result.positives,
  };
}

export async function analyzeProduct(rawQuery: string, opts: EngineOptions = {}): Promise<AnalysisResult> {
  const base = heuristicAnalyze(rawQuery);
  const summaries = await searchAllMarketplaces(base.productName, { country: opts.country });
  const hybrid = withMarketplaceData(base, summaries);
  return withHistoricalIntelligence(hybrid, summaries);
}

// Searches every registered marketplace with the user's exact query and
// scores each real listing returned — never a candidate name we made up.
// Each available marketplace gets its own MarketContext (never mixes
// listing counts, seller counts, or price bands across marketplaces), then
// every marketplace's scored listings are merged into one ranked list. A
// marketplace that isn't configured or fails simply contributes nothing —
// see searchAllMarketplaces, which already turns that into a graceful
// `unavailable` summary instead of a thrown error.
export async function discoverOpportunities(
  rawQuery: string,
  limit = 30,
  opts: EngineOptions = {}
): Promise<DiscoveryResult> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { products: [] };

  const summaries = await searchAllMarketplaces(trimmed, { country: opts.country, limit: 30 });
  const available = summaries.filter((s) => s.available && s.listings.length > 0);

  if (available.length === 0) {
    // A connected marketplace that simply found no listings for this query
    // is a different situation from every marketplace being unreachable —
    // don't let an unrelated provider's "not configured" reason misattribute
    // an empty result to the wrong marketplace.
    const anyConnected = summaries.some((s) => s.available);
    // Among the failure reasons, a *configured* provider's real error (e.g.
    // Mercado Libre rejecting a search with a live token) is always more
    // actionable than an unconfigured provider's generic "add these env
    // vars" message — and registry order otherwise always surfaces Amazon's
    // reason first (it's index 0 and, being unconfigured by default, always
    // has one), which misrepresents Amazon as required even when a
    // configured provider actually ran and failed for its own reason.
    const configuredReason = summaries.find((s, i) => s.reason && marketplaceProviders[i].isConfigured())?.reason;
    const reason = anyConnected ? undefined : configuredReason ?? summaries.find((s) => s.reason)?.reason;
    return {
      products: [],
      reason: reason ?? "No products found across connected marketplaces.",
    };
  }

  const scored = available.flatMap((summary) => {
    const sellerCountMeasured = summary.sellerCount !== undefined;
    const market: MarketContext = {
      marketplace: summary.marketplace,
      marketplaceName: summary.marketplaceName,
      totalListings: summary.listingCount,
      totalSellers: estimateSellerCount(summary.listingCount, summary.sellerCount),
      priceMin: summary.minPrice ?? summary.averagePrice ?? 0,
      priceMax: summary.maxPrice ?? summary.averagePrice ?? 0,
      averagePrice: summary.averagePrice,
      averageRating: summary.averageRating,
      brandConcentration: computeBrandConcentration(summary.listings),
      currency: summary.currency ?? "",
    };
    return summary.listings.map((listing, rank) => {
      const product = scoreMarketplaceProduct(listing, market, rank);
      // Competition was built on an estimated (not provider-reported)
      // seller count for this marketplace — reflect that in the UI instead
      // of claiming it as measured.
      if (!sellerCountMeasured) {
        product.dimensionSources = { ...product.dimensionSources, competition: "ai-estimate" };
      }
      return product;
    });
  });

  // Amazon listings only — Keepa is keyed by ASIN and has nothing to say
  // about Mercado Libre/eBay/Walmart listings. Runs after each listing's
  // baseline score (above) and before the final sort, so an ASIN with a
  // strong real historical trend can actually move up the ranking instead
  // of only affecting a number nobody re-sorts by. Best-effort per listing —
  // a Keepa failure/timeout on one ASIN never drops or blocks the rest.
  const enriched = await Promise.all(
    scored.map(async (product) => {
      if (product.marketplace !== "amazon") return product;
      const asin = extractAsin(product.permalink);
      if (!asin) return product;

      const history = await keepaProvider.getProductHistory(asin).catch(() => null);
      const signals = analyzeHistory(history);
      const blend = applyHistoricalSignals(product.dimensions, product.dimensionSources, signals);

      const profile = getCategoryProfileByName(product.category);
      const opportunityScore = computeOpportunityScore(profile, blend.dimensions);
      const recommendation = computeRecommendation({ opportunityScore, dimensions: blend.dimensions });

      return {
        ...product,
        dimensions: blend.dimensions,
        dimensionSources: blend.sources,
        opportunityScore,
        recommendation,
        shortExplanation:
          blend.notes.length > 0 ? `${product.shortExplanation} ${blend.notes.join(" ")}` : product.shortExplanation,
      };
    })
  );

  enriched.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return { products: enriched.slice(0, limit) };
}

export const hybridProvider: MarketIntelligenceProvider = {
  name: "Hybrid AI + Marketplace Engine",
  analyzeProduct,
  discoverOpportunities,
};
