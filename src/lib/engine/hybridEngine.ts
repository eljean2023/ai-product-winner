// The hybrid layer: takes the pure heuristic engine's output and blends in
// real marketplace data. This is the only file in the engine that knows
// marketplace data exists at all — it talks to the marketplace layer only
// through `searchAllMarketplaces`, never a specific provider, so the engine
// stays decoupled from where the data actually comes from.
import { searchAllMarketplaces } from "@/lib/marketplace/registry";
import type { MarketplaceSummary } from "@/lib/marketplace/types";
import { getCategoryProfileByName } from "./categoryProfiles";
import {
  analyzeProduct as heuristicAnalyze,
  explainMatch,
  pickRecommendation,
  rankCandidates,
} from "./heuristicProvider";
import type {
  AnalysisResult,
  DataConfidence,
  EngineOptions,
  MarketIntelligenceProvider,
  ProductOpportunity,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Prefer Mercado Libre as the primary real price band (per product
// priority), falling back to any other available marketplace. Never mixes
// currencies from two different marketplaces into one min/max band.
function pickPrimarySummary(summaries: MarketplaceSummary[]): MarketplaceSummary | undefined {
  return (
    summaries.find((s) => s.marketplace === "mercadolibre" && s.available) ??
    summaries.find((s) => s.available)
  );
}

interface MarketplaceAdjustment {
  demandFromData: number;
  competitionFromData: number;
  marginFromData?: number;
  marketplaceScore: number;
  primary?: MarketplaceSummary;
}

function computeAdjustment(base: AnalysisResult, summaries: MarketplaceSummary[]): MarketplaceAdjustment | null {
  const available = summaries.filter((s) => s.available);
  if (available.length === 0) return null;

  const totalListings = available.reduce((sum, s) => sum + s.listingCount, 0);
  const totalSellers = available.reduce((sum, s) => sum + (s.sellerCount ?? s.listingCount), 0);

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

  const marketplaceScore = Math.round(
    demandFromData * 0.4 +
      (100 - competitionFromData) * 0.35 +
      (marginFromData ?? base.dimensions.margin) * 0.25
  );

  return { demandFromData, competitionFromData, marginFromData, marketplaceScore, primary };
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
  };

  const opportunityScore = Math.round(base.opportunityScore * 0.6 + adjustment.marketplaceScore * 0.4);
  const primary = adjustment.primary;

  return {
    ...base,
    dimensions,
    demand: dimensions.demand,
    competition: dimensions.competition,
    marginPotential: dimensions.margin,
    opportunityScore,
    recommendation: pickRecommendation(opportunityScore),
    priceMin: primary?.minPrice ?? base.priceMin,
    priceMax: primary?.maxPrice ?? base.priceMax,
    priceCurrency: primary?.currency ?? base.priceCurrency,
    marketplaceData: summaries,
    dataConfidence: "hybrid" as DataConfidence,
    positives: [...base.positives, ...notes.positives].slice(0, 8),
    risks: [...base.risks, ...notes.risks].slice(0, 6),
  };
}

export async function analyzeProduct(rawQuery: string, opts: EngineOptions = {}): Promise<AnalysisResult> {
  const base = heuristicAnalyze(rawQuery);
  const summaries = await searchAllMarketplaces(base.productName, { country: opts.country });
  return withMarketplaceData(base, summaries);
}

export async function discoverOpportunities(
  rawQuery: string,
  limit = 5,
  opts: EngineOptions = {}
): Promise<ProductOpportunity[]> {
  const candidates = rankCandidates(rawQuery, limit);

  const enriched = await Promise.all(
    candidates.map(async ({ result, intent }) => {
      const summaries = await searchAllMarketplaces(result.productName, { country: opts.country });
      const hybrid = withMarketplaceData(result, summaries);
      return { hybrid, intent };
    })
  );

  enriched.sort((a, b) => b.hybrid.opportunityScore - a.hybrid.opportunityScore);

  return enriched.map(({ hybrid, intent }) => ({
    productName: hybrid.productName,
    category: hybrid.category,
    opportunityScore: hybrid.opportunityScore,
    recommendation: hybrid.recommendation,
    shortExplanation: explainMatch(hybrid, intent),
    demand: hybrid.demand,
    competition: hybrid.competition,
    marginPotential: hybrid.marginPotential,
    priceMin: hybrid.priceMin,
    priceMax: hybrid.priceMax,
    priceCurrency: hybrid.priceCurrency,
    imageUrl: hybrid.marketplaceData.find((s) => s.available)?.topListing?.imageUrl,
    marketplaceData: hybrid.marketplaceData,
    dataConfidence: hybrid.dataConfidence,
  }));
}

export const hybridProvider: MarketIntelligenceProvider = {
  name: "Hybrid AI + Marketplace Engine",
  analyzeProduct,
  discoverOpportunities,
};
