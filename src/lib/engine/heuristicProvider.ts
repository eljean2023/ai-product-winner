import { seededValue } from "./hash";
import { FALLBACK_PROFILE, findCategoryProfile, type CategoryProfile } from "./categoryProfiles";
import { computeConfidence } from "./confidence";
import { generateReasoning } from "./reasoning";
import { detectBrand, findBrand } from "./brands";
import { applyBrandAdjustment } from "./scoringUtils";
import { generateSellingAngle } from "./sellingAngle";
import {
  RISK_DIMENSIONS,
  type AnalysisResult,
  type DimensionKey,
  type DimensionScores,
  type Recommendation,
} from "./types";

function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      // Preserve already-uppercase model-number-style tokens (USB-C, 2L,
      // 30W, RGB) instead of mangling them into "Usb-c" / "2l" / "30w".
      const looksLikeCodeOrAcronym = /[0-9]/.test(word) || word.includes("-");
      if (looksLikeCodeOrAcronym && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function pickRecommendation(score: number): Recommendation {
  if (score >= 75) return "Strong Opportunity";
  if (score >= 50) return "Possible Opportunity";
  return "High Risk";
}

export function deriveDimensions(profile: CategoryProfile, seed: string): DimensionScores {
  const dims = {} as DimensionScores;
  (Object.keys(profile.ranges) as DimensionKey[]).forEach((key) => {
    const { min, max } = profile.ranges[key];
    dims[key] = seededValue(`${seed}::${key}`, min, max);
  });
  return dims;
}

export function computeOpportunityScore(profile: CategoryProfile, dims: DimensionScores): number {
  let score = 0;
  (Object.keys(profile.weights) as DimensionKey[]).forEach((key) => {
    const favorable = RISK_DIMENSIONS.includes(key) ? 100 - dims[key] : dims[key];
    score += favorable * profile.weights[key];
  });
  return Math.round(score);
}

function derivePriceBand(profile: CategoryProfile, seed: string) {
  const spread = profile.priceCeiling - profile.priceFloor;
  const priceMin = profile.priceFloor + seededValue(`${seed}::priceMin`, 0, Math.round(spread * 0.35));
  const remaining = profile.priceCeiling - priceMin;
  const priceMax = priceMin + Math.max(5, seededValue(`${seed}::priceMax`, Math.round(remaining * 0.3), remaining));
  return { priceMin, priceMax };
}

// Shared by analyzeProduct (category inferred from the query text) and
// discovery (category already known — the candidate came from that
// category's own curated list, so re-deriving it by keyword match would be
// wrong whenever the product name doesn't happen to contain a keyword).
function buildAnalysis(query: string, profile: CategoryProfile, matchedCategory: boolean): AnalysisResult {
  const seed = query.toLowerCase() || "unnamed product";

  const branded = detectBrand(query);
  const dimensions = applyBrandAdjustment(deriveDimensions(profile, seed), branded);
  const opportunityScore = computeOpportunityScore(profile, dimensions);
  const { priceMin, priceMax } = derivePriceBand(profile, seed);
  const { positives, risks } = generateReasoning(profile, dimensions, seed);
  const { level: confidence, reason: confidenceReason } = computeConfidence(query, matchedCategory);
  const sellingAngle = generateSellingAngle(query, profile.category, branded, dimensions.margin, seed);

  if (branded) {
    const brandName = findBrand(query);
    risks.unshift(`Dominated by ${brandName} and other established brands — a new entrant will struggle to out-rank them organically.`);
  } else {
    positives.unshift("Private label opportunity — no dominant brand controls this search yet.");
  }

  return {
    productName: titleCase(query) || "Unnamed Product",
    category: profile.category,
    opportunityScore,
    recommendation: pickRecommendation(opportunityScore),
    confidence,
    confidenceReason,
    dimensions,
    priceMin,
    priceMax,
    priceCurrency: "USD",
    positives: positives.slice(0, 6),
    risks: risks.slice(0, 4),
    demand: dimensions.demand,
    competition: dimensions.competition,
    marginPotential: dimensions.margin,
    sellingAngle,
    marketplaceData: [],
    dataConfidence: "heuristic-only",
  };
}

export function analyzeProduct(rawQuery: string): AnalysisResult {
  const query = rawQuery.trim();
  const matched = findCategoryProfile(query);
  return buildAnalysis(query, matched ?? FALLBACK_PROFILE, matched !== null);
}
