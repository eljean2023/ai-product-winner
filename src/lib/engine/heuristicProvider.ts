import { seededValue } from "./hash";
import {
  CATEGORY_PROFILES,
  FALLBACK_PROFILE,
  findCategoryProfile,
  type CategoryProfile,
} from "./categoryProfiles";
import { computeConfidence } from "./confidence";
import { generateReasoning } from "./reasoning";
import {
  RISK_DIMENSIONS,
  type AnalysisResult,
  type DimensionKey,
  type DimensionScores,
  type ProductOpportunity,
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

function deriveDimensions(profile: CategoryProfile, seed: string): DimensionScores {
  const dims = {} as DimensionScores;
  (Object.keys(profile.ranges) as DimensionKey[]).forEach((key) => {
    const { min, max } = profile.ranges[key];
    dims[key] = seededValue(`${seed}::${key}`, min, max);
  });
  return dims;
}

function computeOpportunityScore(profile: CategoryProfile, dims: DimensionScores): number {
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

  const dimensions = deriveDimensions(profile, seed);
  const opportunityScore = computeOpportunityScore(profile, dimensions);
  const { priceMin, priceMax } = derivePriceBand(profile, seed);
  const { positives, risks } = generateReasoning(profile, dimensions, seed);
  const { level: confidence, reason: confidenceReason } = computeConfidence(query, matchedCategory);

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
    positives,
    risks,
    demand: dimensions.demand,
    competition: dimensions.competition,
    marginPotential: dimensions.margin,
    marketplaceData: [],
    dataConfidence: "heuristic-only",
  };
}

export function analyzeProduct(rawQuery: string): AnalysisResult {
  const query = rawQuery.trim();
  const matched = findCategoryProfile(query);
  return buildAnalysis(query, matched ?? FALLBACK_PROFILE, matched !== null);
}

// ---------------------------------------------------------------------------
// Discovery: infer intent from free text (budget, shipping ease, margin,
// size, "trending", or genuine indecision) and rank candidates accordingly,
// rather than doing a flat keyword match against a fixed candidate list.
// ---------------------------------------------------------------------------

export interface Intent {
  categories: CategoryProfile[];
  budgetMax?: number;
  wantsEasyShipping: boolean;
  wantsHighMargin: boolean;
  wantsSmall: boolean;
  wantsTrending: boolean;
  isUndecided: boolean;
}

function parseIntent(query: string): Intent {
  const lower = query.toLowerCase();
  const categories = CATEGORY_PROFILES.filter((profile) =>
    profile.keywords.some((keyword) => lower.includes(keyword))
  );

  let budgetMax: number | undefined;
  const budgetMatch = lower.match(/\$\s?(\d[\d,]{1,6})|(\d[\d,]{1,6})\s?(dollars|usd|bucks)/);
  const mentionsBudget = /\$|budget|have|spend|invest|under|less than|below/.test(lower);
  if (mentionsBudget && budgetMatch) {
    const raw = (budgetMatch[1] ?? budgetMatch[2] ?? "").replace(/,/g, "");
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) budgetMax = parsed;
  }

  return {
    categories,
    budgetMax,
    wantsEasyShipping: /easy to ship|easy shipping|lightweight|ships? easily|simple to ship/.test(lower),
    wantsHighMargin: /high margin|good margin|profitable|high profit|best margin/.test(lower),
    wantsSmall: /small product|small item|compact|small products|tiny product/.test(lower),
    wantsTrending: /trending|trend\b|popular|hot right now|hot seller/.test(lower),
    isUndecided:
      /don'?t know|no idea|not sure|what should i sell|where do i start/.test(lower) ||
      lower.length === 0,
  };
}

interface CandidateRef {
  name: string;
  profile: CategoryProfile;
}

function poolForCategories(categories: CategoryProfile[]): CandidateRef[] {
  const seen = new Set<string>();
  const refs: CandidateRef[] = [];
  for (const profile of categories) {
    for (const name of profile.candidates) {
      if (seen.has(name)) continue;
      seen.add(name);
      refs.push({ name, profile });
    }
  }
  return refs;
}

interface ScoredCandidate {
  result: AnalysisResult;
  fit: number;
}

function scoreCandidate(candidate: CandidateRef, intent: Intent): ScoredCandidate {
  // The candidate's category is already known — it came from that
  // category's own curated list — so score it directly against that
  // profile rather than re-deriving the category from the name.
  const result = buildAnalysis(candidate.name, candidate.profile, true);
  let fit = result.opportunityScore;
  if (intent.wantsEasyShipping || intent.wantsSmall) {
    fit += (100 - result.dimensions.shippingComplexity) * 0.3;
  }
  if (intent.wantsHighMargin) {
    fit += result.dimensions.margin * 0.3;
  }
  if (intent.wantsTrending) {
    fit += result.dimensions.demand * 0.25;
  }
  return { result, fit };
}

function roundRobinByCategory(items: ScoredCandidate[], limit: number): ScoredCandidate[] {
  const byCategory = new Map<string, ScoredCandidate[]>();
  for (const item of items) {
    const list = byCategory.get(item.result.category) ?? [];
    list.push(item);
    byCategory.set(item.result.category, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => b.fit - a.fit);
  }

  const groups = Array.from(byCategory.values());
  const picked: ScoredCandidate[] = [];
  let round = 0;
  while (picked.length < limit && groups.some((g) => g[round])) {
    for (const group of groups) {
      if (picked.length >= limit) break;
      if (group[round]) picked.push(group[round]);
    }
    round++;
  }
  return picked.sort((a, b) => b.fit - a.fit);
}

export function explainMatch(result: AnalysisResult, intent: Intent): string {
  const parts: string[] = [];
  if (intent.budgetMax !== undefined) {
    parts.push(`Fits within a $${intent.budgetMax} budget ($${result.priceMin}-$${result.priceMax})`);
  }
  if (intent.wantsEasyShipping || intent.wantsSmall) {
    parts.push(`Ships easily — Shipping Complexity is only ${result.dimensions.shippingComplexity}/100`);
  }
  if (intent.wantsHighMargin) {
    parts.push(`Strong margin potential at ${result.dimensions.margin}/100`);
  }
  if (intent.wantsTrending) {
    parts.push(`Currently high demand at ${result.dimensions.demand}/100`);
  }
  if (parts.length === 0 && intent.isUndecided) {
    parts.push(`A well-rounded pick in ${result.category} — strong across demand, margin, and competition`);
  }
  if (parts.length === 0) {
    parts.push(result.positives[0] ?? "Balanced demand and margin profile");
  }
  return parts.map((p) => (p.endsWith(".") ? p : `${p}.`)).join(" ");
}

export interface RankedCandidate {
  result: AnalysisResult;
  fit: number;
  intent: Intent;
}

// Shortlists and ranks candidates from the curated per-category pool, using
// the heuristic engine only. Split out from discoverOpportunities so the
// hybrid engine can take this shortlist and enrich just these (typically
// `limit`, not the whole pool) with real marketplace data instead of doing
// so for every candidate.
export function rankCandidates(rawQuery: string, limit = 5): RankedCandidate[] {
  const query = rawQuery.trim();
  const intent = parseIntent(query);

  const usingDiversifiedPool = intent.categories.length === 0;
  const pool = usingDiversifiedPool
    ? poolForCategories(CATEGORY_PROFILES)
    : poolForCategories(intent.categories);

  let scored = pool.map((candidate) => scoreCandidate(candidate, intent));

  if (intent.budgetMax !== undefined) {
    const withinBudget = scored.filter((s) => s.result.priceMax <= intent.budgetMax! * 1.15);
    scored = withinBudget.length >= Math.min(3, limit)
      ? withinBudget
      : [...scored].sort((a, b) => a.result.priceMax - b.result.priceMax);
  }

  const ranked = usingDiversifiedPool
    ? roundRobinByCategory(scored, limit)
    : [...scored].sort((a, b) => b.fit - a.fit).slice(0, limit);

  return ranked.slice(0, limit).map((candidate) => ({ ...candidate, intent }));
}

export function discoverOpportunities(rawQuery: string, limit = 5): ProductOpportunity[] {
  return rankCandidates(rawQuery, limit).map(({ result, intent }) => ({
    productName: result.productName,
    category: result.category,
    opportunityScore: result.opportunityScore,
    recommendation: result.recommendation,
    shortExplanation: explainMatch(result, intent),
    demand: result.demand,
    competition: result.competition,
    marginPotential: result.marginPotential,
    priceMin: result.priceMin,
    priceMax: result.priceMax,
    priceCurrency: result.priceCurrency,
    marketplaceData: result.marketplaceData,
    dataConfidence: result.dataConfidence,
  }));
}
