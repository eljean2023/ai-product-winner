import { hashString } from "./hash";
import type { CategoryProfile } from "./categoryProfiles";
import { RISK_DIMENSIONS, type DimensionKey, type DimensionScores } from "./types";

type PhraseFn = (category: string, value: number) => string;

interface DimensionPhrasing {
  good: PhraseFn;
  bad: PhraseFn;
}

// One quantified phrase per dimension per direction. These always embed the
// actual computed score and category name, so the same dimension reads
// differently across products instead of repeating boilerplate text.
const DIMENSION_PHRASING: Record<DimensionKey, DimensionPhrasing> = {
  demand: {
    good: (cat, v) => `Demand Potential scored ${v}/100 — buyers are actively searching for products like this in ${cat}`,
    bad: (cat, v) => `Demand Potential is only ${v}/100 — interest in this ${cat.toLowerCase()} niche looks soft or unproven`,
  },
  competition: {
    good: (cat, v) => `Competition Risk sits at ${v}/100 — fewer entrenched sellers than a typical ${cat.toLowerCase()} listing`,
    bad: (cat, v) => `Competition Risk is high at ${v}/100 — expect a crowded ${cat.toLowerCase()} market with established sellers`,
  },
  margin: {
    good: (_cat, v) => `Margin Potential scored ${v}/100 — healthy room between landed cost and typical selling price`,
    bad: (_cat, v) => `Margin Potential is thin at ${v}/100 — fees and shipping will eat into profit quickly`,
  },
  shippingComplexity: {
    good: (_cat, v) => `Shipping Complexity is low at ${v}/100 — lightweight and simple to fulfill`,
    bad: (_cat, v) => `Shipping Complexity runs high at ${v}/100 — bulk, weight, or fragility will raise fulfillment costs`,
  },
  supplierAvailability: {
    good: (_cat, v) => `Supplier Availability scored ${v}/100 — multiple sourcing options should keep lead times short`,
    bad: (_cat, v) => `Supplier Availability is limited at ${v}/100 — sourcing will need extra vetting`,
  },
  bundlePotential: {
    good: (_cat, v) => `Bundle Potential scored ${v}/100 — pairs naturally with add-ons and upsell offers`,
    bad: (_cat, v) => `Bundle Potential is limited at ${v}/100 — few natural upsell or accessory pairings`,
  },
  brandOpportunity: {
    good: (_cat, v) => `Brand Opportunity scored ${v}/100 — room to build a differentiated, memorable listing`,
    bad: (_cat, v) => `Brand Opportunity is limited at ${v}/100 — hard to stand out from generic competitors`,
  },
  repeatPurchase: {
    good: (_cat, v) => `Repeat Purchase Potential scored ${v}/100 — customers are likely to reorder or consume this repeatedly`,
    bad: (_cat, v) => `Repeat Purchase Potential is low at ${v}/100 — likely a one-and-done purchase`,
  },
  trendStability: {
    good: (_cat, v) => `Trend Stability scored ${v}/100 — demand should hold up year-round rather than spike and fade`,
    bad: (_cat, v) => `Trend Stability is only ${v}/100 — demand is seasonal or trend-sensitive and could cool off`,
  },
  returnRisk: {
    good: (_cat, v) => `Return Risk is low at ${v}/100 — customers are unlikely to send this back`,
    bad: (_cat, v) => `Return Risk runs ${v}/100 — expect returns from fit issues, defects, or buyer's remorse`,
  },
};

function favorability(key: DimensionKey, value: number): number {
  return RISK_DIMENSIONS.includes(key) ? 100 - value : value;
}

export interface Reasoning {
  positives: string[];
  risks: string[];
}

export function generateReasoning(
  profile: CategoryProfile,
  dims: DimensionScores,
  seed: string
): Reasoning {
  const keys = Object.keys(dims) as DimensionKey[];
  const ranked = keys
    .map((key) => ({ key, value: dims[key], fav: favorability(key, dims[key]) }))
    .sort((a, b) => b.fav - a.fav);

  const bestFour = ranked.slice(0, 4);
  const worstThree = [...ranked].sort((a, b) => a.fav - b.fav).slice(0, 3);

  const quantifiedPositives = bestFour.map((d) =>
    DIMENSION_PHRASING[d.key].good(profile.category, d.value)
  );
  const quantifiedRisks = worstThree.map((d) =>
    DIMENSION_PHRASING[d.key].bad(profile.category, d.value)
  );

  const flavorPositiveStart = hashString(`${seed}::flavorP`) % profile.flavorPositives.length;
  const flavorPositives = [
    profile.flavorPositives[flavorPositiveStart],
    profile.flavorPositives[(flavorPositiveStart + 1) % profile.flavorPositives.length],
  ];

  const flavorRiskStart = hashString(`${seed}::flavorR`) % profile.flavorRisks.length;
  const flavorRisk = profile.flavorRisks[flavorRiskStart];

  const positives = Array.from(
    new Set([...quantifiedPositives, ...flavorPositives])
  ).slice(0, 6);
  const risks = Array.from(new Set([...quantifiedRisks, flavorRisk])).slice(0, 4);

  return { positives, risks };
}
