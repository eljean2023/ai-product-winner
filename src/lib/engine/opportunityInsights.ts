// Decision-making layer: turns an already-scored AnalysisResult into
// concrete, actionable seller guidance (recommendation, strategy, target
// customer, differentiation ideas). Every function here is a pure,
// synchronous read of fields the scoring engine already computed — it never
// recomputes a score or dimension, only interprets what's already there.
import { detectBrand, findBrand } from "./brands";
import { DIMENSION_LABELS, RISK_DIMENSIONS, type DimensionKey, type DimensionScores, type Recommendation } from "./types";

// The minimal shape computeRecommendation needs — satisfied structurally by
// both AnalysisResult (heuristic/hybrid single-product analysis) and
// ProductOpportunity (per-listing discovery results), so both paths run the
// exact same recommendation logic instead of each keeping their own copy.
export interface ScoredSubject {
  opportunityScore: number;
  dimensions: DimensionScores;
}

// What generateOpportunityInsights needs beyond the score/dimensions to
// produce seller-facing copy. AnalysisResult satisfies this directly;
// ProductOpportunity is adapted with `{ ...product, productName: product.title }`.
export interface InsightSubject extends ScoredSubject {
  productName: string;
  category: string;
}

export interface OpportunityInsights {
  recommendation: Recommendation;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestedStrategy: string;
  targetCustomer: string;
  differentiationIdeas: string[];
  // Concrete "sell this instead" suggestions — populated only for High Risk
  // results (accessories/complements when brand-dominated, a narrower niche
  // when saturated/low-scoring) so a rejection comes with a next move.
  alternatives: string[];
}

interface CategoryInsightProfile {
  targetCustomer: string;
  featureHook: string;
  ideas: [string, string, string];
}

// One profile per category already defined in categoryProfiles.ts. Kept as
// its own transparent, category-flavored bank (rather than re-deriving text
// from the numeric dimensions) so seller-facing advice reads like concrete
// guidance instead of restated scores.
const CATEGORY_INSIGHTS: Record<string, CategoryInsightProfile> = {
  Gaming: {
    targetCustomer: "PC gamers and streamers",
    featureHook: "lower input lag and customizable RGB lighting",
    ideas: [
      "Focus on a specific genre or peripheral niche (FPS, MOBA, streaming setups)",
      "Improve response time, build quality, or add customizable lighting",
      "Bundle with a mousepad or other complementary gaming accessory",
    ],
  },
  Office: {
    targetCustomer: "Remote and hybrid office workers",
    featureHook: "better ergonomics and easier assembly",
    ideas: [
      "Focus on a specific desk setup or ergonomic need (standing desks, small spaces)",
      "Offer stronger ergonomic support or easier assembly than competitors",
      "Bundle with complementary desk accessories (organizers, lighting, cable management)",
    ],
  },
  Kitchen: {
    targetCustomer: "Home organization buyers",
    featureHook: "easier cleanup and a space-saving design",
    ideas: [
      "Focus on a specific use case (meal prep, small kitchens, dietary needs)",
      "Offer a durability, dishwasher-safe, or space-saving advantage",
      "Bundle with recipe guides or complementary kitchen tools",
    ],
  },
  Beauty: {
    targetCustomer: "Self-care consumers",
    featureHook: "clean, cruelty-free ingredients",
    ideas: [
      "Focus on a specific skin type, concern, or ingredient story",
      "Offer clean or cruelty-free formulation as a differentiator",
      "Bundle into a routine or kit with complementary products",
    ],
  },
  Fitness: {
    targetCustomer: "Active users and athletes",
    featureHook: "sweat resistance and a more secure, comfortable fit",
    ideas: [
      "Focus on the sports/running niche instead of competing broadly",
      "Improve durability, comfort, or sweat/water resistance",
      "Bundle with a carrying case or complementary fitness accessory",
    ],
  },
  Pet: {
    targetCustomer: "Pet owners",
    featureHook: "safer materials and easier cleaning",
    ideas: [
      "Focus on a specific pet size, breed, or lifestyle need",
      "Offer safer materials or easier-to-clean construction",
      "Bundle with treats or a complementary pet accessory",
    ],
  },
  Baby: {
    targetCustomer: "New parents",
    featureHook: "stricter safety certification and easier washing",
    ideas: [
      "Focus on a specific age range or safety-conscious niche",
      "Lead with safety certification and easy-wash materials",
      "Bundle into a gift-ready set for baby showers",
    ],
  },
  Fashion: {
    targetCustomer: "Style-conscious shoppers",
    featureHook: "better materials and more consistent sizing",
    ideas: [
      "Focus on a specific style, occasion, or trend niche",
      "Improve material quality or sizing consistency versus competitors",
      "Bundle into a styled set with complementary accessories",
    ],
  },
  Automotive: {
    targetCustomer: "Everyday drivers",
    featureHook: "a universal fit and easier installation",
    ideas: [
      "Focus on a specific vehicle type or use case",
      "Offer a universal-fit or easier-installation advantage",
      "Bundle with complementary car accessories",
    ],
  },
  Camping: {
    targetCustomer: "Outdoor and camping enthusiasts",
    featureHook: "lighter weight and better weather resistance",
    ideas: [
      "Focus on a specific activity (backpacking, car camping, day hikes)",
      "Improve weight, packability, or weather resistance",
      "Bundle with complementary outdoor gear",
    ],
  },
  Garden: {
    targetCustomer: "Home gardeners",
    featureHook: "more durable, weather-resistant materials",
    ideas: [
      "Focus on a specific gardening use case (raised beds, containers, indoor)",
      "Offer more durable, weather-resistant materials",
      "Bundle with complementary garden tools",
    ],
  },
  Tools: {
    targetCustomer: "DIY and home-improvement buyers",
    featureHook: "better ergonomics and a longer warranty",
    ideas: [
      "Focus on a specific trade or DIY use case",
      "Offer better ergonomics, durability, or a longer warranty",
      "Bundle into a kit with complementary tools",
    ],
  },
  Home: {
    targetCustomer: "Home-improvement shoppers",
    featureHook: "quieter operation and easier setup",
    ideas: [
      "Focus on a specific room or home-improvement need",
      "Improve build quality, noise level, or ease of setup",
      "Bundle with complementary home accessories",
    ],
  },
  Electronics: {
    targetCustomer: "Everyday tech buyers",
    featureHook: "longer battery life and a more durable, water-resistant design",
    ideas: [
      "Focus on the sports/running niche instead of competing broadly",
      "Improve battery life or charging speed beyond typical listings",
      "Bundle with charging accessories (case, cable, power bank)",
    ],
  },
  "General Merchandise": {
    targetCustomer: "Everyday online shoppers",
    featureHook: "clearer branding and better packaging",
    ideas: [
      "Focus on a specific niche audience instead of competing broadly",
      "Improve build quality or add a feature competitors lack",
      "Bundle with a complementary accessory to raise average order value",
    ],
  },
};

const FALLBACK_INSIGHT_PROFILE = CATEGORY_INSIGHTS["General Merchandise"];

// A product's own title can point at a sharper target customer than its
// category alone (e.g. a "sport" earbud within Electronics) — checked
// before falling back to the category-level default above.
const TITLE_TARGET_OVERRIDES: { pattern: RegExp; targetCustomer: string }[] = [
  { pattern: /\bsports?\b|running|\bgym\b|workout|athletic|training/i, targetCustomer: "Active users and athletes" },
  { pattern: /gaming|gamer|esports/i, targetCustomer: "PC gamers and streamers" },
  { pattern: /kids?|children|toddler/i, targetCustomer: "Parents shopping for kids" },
  { pattern: /travel|portable|compact|mini/i, targetCustomer: "Frequent travelers" },
  { pattern: /office|work|professional|desk/i, targetCustomer: "Remote and hybrid office workers" },
  { pattern: /outdoor|camp|hiking/i, targetCustomer: "Outdoor enthusiasts" },
  { pattern: /pet|dog|cat/i, targetCustomer: "Pet owners" },
  { pattern: /baby|infant|nursery/i, targetCustomer: "New parents" },
];

// Several categories (Electronics, Gaming, Beauty, Fashion) are authored
// with an inherently high competition band, which Market Saturation is
// derived from — so a lower bar here would just re-trigger the same signal
// the score itself already reflects. 85+ reserves "saturated" messaging for
// genuinely extreme, near-commodity saturation instead of overlapping with
// the score-based cutoff.
const SATURATION_HIGH_THRESHOLD = 85;
// Below this, Brand Opportunity reflects a real recognized brand in the
// title (see applyBrandAdjustment, which clamps branded listings to 3-20)
// rather than just an unlucky category-baseline draw.
const BRAND_DOMINATED_THRESHOLD = 25;

function categoryProfile(category: string): CategoryInsightProfile {
  return CATEGORY_INSIGHTS[category] ?? FALLBACK_INSIGHT_PROFILE;
}

function inferTargetCustomer(title: string, category: string): string {
  const hit = TITLE_TARGET_OVERRIDES.find((k) => k.pattern.test(title));
  if (hit) return hit.targetCustomer;
  return categoryProfile(category).targetCustomer;
}

// Score alone ranks products; this layer decides whether a new seller
// should actually pursue one. A high score from a brand-dominated or
// already-saturated market is downgraded to High Risk even if the raw
// number looks good — that's the whole point of separating this from
// scoring.
//
// PERMANENT ARCHITECTURAL PRINCIPLE — see AGENTS.md "Recommendation engine:
// conservative by permanent design": the 80/60/60/60 Strong Opportunity bar
// and the 60 / 85 High Risk cutoffs below must never be loosened to reduce
// how many products land on "High Risk". It is better to reject a mediocre
// product than recommend a poor investment. If too many products end up
// High Risk, the fix is improving the scoring engine's inputs (better
// marketplace signals — Keepa price/sales-rank history, review velocity,
// Buy Box, seller concentration, marketplace diversity, ...) so genuinely
// strong products naturally clear 80+, not lowering these numbers.
export function computeRecommendation(subject: ScoredSubject): Recommendation {
  const { opportunityScore, dimensions } = subject;
  const brandDominated = dimensions.brandOpportunity < BRAND_DOMINATED_THRESHOLD;
  const saturationHigh = dimensions.marketSaturation >= SATURATION_HIGH_THRESHOLD;

  if (opportunityScore < 60 || brandDominated || saturationHigh) {
    return "High Risk";
  }

  const competitionAcceptable = dimensions.competition <= 60;
  if (
    opportunityScore >= 80 &&
    dimensions.brandOpportunity >= 60 &&
    dimensions.margin >= 60 &&
    competitionAcceptable
  ) {
    return "Strong Opportunity";
  }

  return "Possible Opportunity";
}

// Named, business-relevant dimensions worth citing by name in a "why" — the
// full dimension set includes a few (bundlePotential, trendStability, ...)
// that are too abstract to read as a cause in a sentence.
const NAMEABLE_DIMENSIONS: DimensionKey[] = ["demand", "margin", "competition", "marketSaturation", "returnRisk"];

// Names the weakest contributing factors behind a low score, so a generic
// High Risk verdict states a concrete reason grounded in the actual numbers
// instead of just restating the score.
function weakestFactors(dimensions: DimensionScores, count = 2): string[] {
  const scored = NAMEABLE_DIMENSIONS.map((key) => ({
    key,
    favorability: RISK_DIMENSIONS.includes(key) ? 100 - dimensions[key] : dimensions[key],
  }));
  scored.sort((a, b) => a.favorability - b.favorability);
  return scored.slice(0, count).map((s) => `${DIMENSION_LABELS[s.key]} (${dimensions[s.key]}/100)`);
}

function buildSummary(
  subject: InsightSubject,
  recommendation: Recommendation,
  branded: boolean,
  brandName: string | null
): string {
  const score = subject.opportunityScore;
  if (branded) {
    return `${subject.productName} shows strong demand (score ${score}/100), but ${brandName} dominates this market — little room for a new seller to compete on this exact product.`;
  }
  if (recommendation === "Strong Opportunity") {
    return `${subject.productName} scores ${score}/100 with healthy margins, manageable competition, and real private-label room — one of the stronger opportunities in this search.`;
  }
  if (recommendation === "High Risk") {
    if (subject.dimensions.marketSaturation >= SATURATION_HIGH_THRESHOLD) {
      return `${subject.productName} scores ${score}/100 in an already saturated market — thousands of near-identical listings make it hard for a new seller to stand out.`;
    }
    return `${subject.productName} scores only ${score}/100 — driven mainly by weak ${weakestFactors(subject.dimensions).join(" and ")} — the numbers don't yet support a new seller entering this exact product.`;
  }
  return `${subject.productName} scores ${score}/100 — a workable opportunity, but success will depend on real differentiation.`;
}

function buildStrategy(
  subject: InsightSubject,
  recommendation: Recommendation,
  branded: boolean,
  brandName: string | null,
  targetCustomer: string,
  featureHook: string
): string {
  if (branded) {
    return `High demand product but not recommended for new sellers due to strong brand dominance from ${brandName}.`;
  }
  if (recommendation === "High Risk") {
    if (subject.dimensions.marketSaturation >= SATURATION_HIGH_THRESHOLD) {
      return `Market is saturated with near-identical listings — only worth entering with a sharply differentiated angle for ${targetCustomer.toLowerCase()}, or consider a different product.`;
    }
    return "Scores too low to recommend as a primary opportunity right now — consider a different product or a niche with clearer demand.";
  }
  return `Create a differentiated private-label product targeting ${targetCustomer.toLowerCase()} with ${featureHook}.`;
}

function buildStrengths(subject: InsightSubject, branded: boolean): string[] {
  const strengths: string[] = [];
  const { dimensions } = subject;
  if (dimensions.demand >= 65) strengths.push("Strong, validated demand for this product.");
  if (!branded && dimensions.brandOpportunity >= 60) strengths.push("No dominant brand — real private-label opportunity.");
  if (dimensions.margin >= 60) strengths.push("Healthy margin potential at typical selling prices.");
  if (dimensions.shippingComplexity <= 35) strengths.push("Lightweight and simple to ship.");
  if (dimensions.bundlePotential >= 60) strengths.push("Pairs naturally with bundle or upsell offers.");
  if (dimensions.repeatPurchase >= 60) strengths.push("Likely to generate repeat purchases.");
  return strengths.slice(0, 4);
}

function buildRisks(subject: InsightSubject, branded: boolean, brandName: string | null): string[] {
  const risks: string[] = [];
  const { dimensions } = subject;
  if (branded) risks.push(`Dominated by ${brandName} — hard to out-rank organically.`);
  if (dimensions.competition >= 70) risks.push("High competition from established sellers.");
  if (dimensions.marketSaturation >= 70) risks.push("Market is saturated with near-identical listings.");
  if (dimensions.returnRisk >= 60) risks.push("Higher-than-average return risk.");
  if (dimensions.margin < 40) risks.push("Thin margins once fees and shipping are factored in.");
  return risks.slice(0, 4);
}

// The consultant layer: when the verdict is High Risk, don't just say no —
// point at what to sell instead. Reuses each category's own bundle idea
// (already accessory-flavored) rather than inventing a second content bank.
function buildAlternatives(
  recommendation: Recommendation,
  branded: boolean,
  brandName: string | null,
  category: string,
  profile: CategoryInsightProfile
): string[] {
  if (recommendation !== "High Risk") return [];

  const alternatives: string[] = [];
  if (branded && brandName) {
    alternatives.push(
      `Sell accessories or complements for ${brandName} products instead of competing head-on — cases, chargers, mounts, and protective gear see steady demand without a brand standoff.`
    );
    alternatives.push(
      `Consider a private-label product in a related niche within ${category} where ${brandName} and other major brands aren't already dominant.`
    );
  } else {
    alternatives.push(
      `Look for a narrower niche within ${category} where competition is lighter — broad, saturated searches like this rarely work for a new seller.`
    );
  }
  alternatives.push(profile.ideas[2]);
  return alternatives.slice(0, 3);
}

export function generateOpportunityInsights(subject: InsightSubject): OpportunityInsights {
  const branded = detectBrand(subject.productName);
  const brandName = branded ? findBrand(subject.productName) : null;
  const profile = categoryProfile(subject.category);
  const targetCustomer = inferTargetCustomer(subject.productName, subject.category);

  const recommendation = computeRecommendation(subject);
  const summary = buildSummary(subject, recommendation, branded, brandName);
  const suggestedStrategy = buildStrategy(subject, recommendation, branded, brandName, targetCustomer, profile.featureHook);
  const strengths = buildStrengths(subject, branded);
  const risks = buildRisks(subject, branded, brandName);
  const alternatives = buildAlternatives(recommendation, branded, brandName, subject.category, profile);
  const differentiationIdeas = [...profile.ideas];

  return {
    recommendation,
    summary,
    strengths,
    risks,
    suggestedStrategy,
    targetCustomer,
    differentiationIdeas,
    alternatives,
  };
}
