export type Recommendation =
  | "Strong Opportunity"
  | "Possible Opportunity"
  | "High Risk";

export interface AnalysisResult {
  productName: string;
  category: string;
  opportunityScore: number;
  recommendation: Recommendation;
  demand: number;
  competition: number;
  marginPotential: number;
  priceMin: number;
  priceMax: number;
  positives: string[];
  risks: string[];
}

interface CategoryProfile {
  category: string;
  keywords: string[];
  demand: number;
  competition: number;
  margin: number;
  priceMin: number;
  priceMax: number;
  positives: string[];
  risks: string[];
}

// Baseline profiles for common e-commerce niches. These stand in for real
// marketplace data until live sources (Amazon, Mercado Libre, etc.) are
// wired up in a future version.
const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    category: "Audio Electronics",
    keywords: ["earbud", "earphone", "headphone", "bluetooth speaker", "speaker"],
    demand: 95,
    competition: 75,
    margin: 90,
    priceMin: 15,
    priceMax: 60,
    positives: ["High consumer demand", "Strong repeat-purchase category"],
    risks: ["Competitive market", "Dominated by established brands"],
  },
  {
    category: "Mobile Accessories",
    keywords: ["charger", "usb-c", "usb c", "power bank", "cable", "phone case", "phone cover"],
    demand: 80,
    competition: 70,
    margin: 58,
    priceMin: 8,
    priceMax: 30,
    positives: ["Consistent, non-seasonal demand", "Low shipping weight and cost"],
    risks: ["Low barrier to entry for competitors", "Frequent price undercutting"],
  },
  {
    category: "Computer Peripherals",
    keywords: ["gaming mouse", "mouse", "keyboard", "mousepad", "webcam", "laptop stand"],
    demand: 72,
    competition: 55,
    margin: 65,
    priceMin: 15,
    priceMax: 70,
    positives: ["Good margin potential", "Enthusiast audience willing to pay more"],
    risks: ["Requires ongoing feature differentiation"],
  },
  {
    category: "Home & Kitchen",
    keywords: ["air fryer", "knife set", "cutting board", "kitchen gadget", "water bottle", "blender", "cookware"],
    demand: 75,
    competition: 65,
    margin: 55,
    priceMin: 12,
    priceMax: 55,
    positives: ["Broad, mainstream appeal", "Frequently gifted category"],
    risks: ["Seasonal demand swings", "Bulky items raise shipping costs"],
  },
  {
    category: "Fitness & Wellness",
    keywords: ["yoga mat", "resistance band", "fitness", "gym", "dumbbell", "workout"],
    demand: 70,
    competition: 60,
    margin: 60,
    priceMin: 10,
    priceMax: 45,
    positives: ["Growing health & wellness trend", "Good margin potential"],
    risks: ["Demand spikes around New Year, then cools"],
  },
  {
    category: "Beauty & Personal Care",
    keywords: ["skincare", "serum", "makeup", "hair dryer", "beauty", "cosmetic"],
    demand: 82,
    competition: 82,
    margin: 68,
    priceMin: 10,
    priceMax: 40,
    positives: ["High margin potential", "High consumer demand"],
    risks: ["Highly saturated market", "Regulatory / labeling requirements"],
  },
  {
    category: "Pet Supplies",
    keywords: ["dog", "cat", "pet", "leash", "pet bed", "pet toy"],
    demand: 68,
    competition: 48,
    margin: 58,
    priceMin: 10,
    priceMax: 35,
    positives: ["Loyal, repeat-buying customer base", "Less price-sensitive niche"],
    risks: ["Sizing/fit variations increase returns"],
  },
  {
    category: "Baby & Kids",
    keywords: ["baby", "infant", "toddler", "nursery", "kids toy"],
    demand: 65,
    competition: 55,
    margin: 55,
    priceMin: 12,
    priceMax: 50,
    positives: ["Buyers prioritize quality over price"],
    risks: ["Strict safety/compliance standards", "Trust-sensitive category for new sellers"],
  },
  {
    category: "Home Office",
    keywords: ["desk organizer", "office", "led strip", "ring light", "monitor stand", "desk lamp"],
    demand: 60,
    competition: 50,
    margin: 60,
    priceMin: 12,
    priceMax: 45,
    positives: ["Good margin potential", "Steady work-from-home demand"],
    risks: ["Trend-dependent, can fade quickly"],
  },
  {
    category: "Outdoor & Camping",
    keywords: ["camping", "outdoor", "hiking", "tent", "backpack", "drone", "action camera"],
    demand: 58,
    competition: 45,
    margin: 55,
    priceMin: 20,
    priceMax: 80,
    positives: ["Less price competition than mainstream categories"],
    risks: ["Strongly seasonal demand"],
  },
  {
    category: "Fashion Accessories",
    keywords: ["sunglasses", "watch", "jewelry", "wallet", "belt", "handbag"],
    demand: 62,
    competition: 72,
    margin: 60,
    priceMin: 10,
    priceMax: 40,
    positives: ["Impulse-buy potential", "Good margin potential"],
    risks: ["Competitive market", "Trend and style risk"],
  },
  {
    category: "Home Comfort",
    keywords: ["humidifier", "diffuser", "essential oil", "air purifier", "heater"],
    demand: 64,
    competition: 52,
    margin: 56,
    priceMin: 15,
    priceMax: 50,
    positives: ["Seasonal demand spikes create timing opportunities"],
    risks: ["Electrical/safety compliance requirements"],
  },
];

const GENERIC_POSITIVES = [
  "Lightweight and easy to ship",
  "Fits well with bundle or upsell offers",
  "Searchable, specific keyword with clear buyer intent",
];

const GENERIC_RISKS = [
  "Limited category data available for this keyword",
  "Demand and competition estimates are unverified without live marketplace data",
];

function titleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Deterministic hash so the same keyword always produces the same result.
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

function findCategoryProfile(query: string): CategoryProfile | null {
  const lower = query.toLowerCase();
  for (const profile of CATEGORY_PROFILES) {
    if (profile.keywords.some((keyword) => lower.includes(keyword))) {
      return profile;
    }
  }
  return null;
}

function buildFallbackProfile(query: string): CategoryProfile {
  const hash = hashString(query.toLowerCase());
  const demand = 35 + (hash % 45); // 35-79
  const competition = 35 + ((hash >> 3) % 50); // 35-84
  const margin = 30 + ((hash >> 6) % 45); // 30-74
  const priceMin = 8 + ((hash >> 9) % 15); // 8-22
  const priceMax = priceMin + 15 + ((hash >> 12) % 40); // priceMin+15 .. +54

  return {
    category: "General Merchandise",
    keywords: [],
    demand,
    competition,
    margin,
    priceMin,
    priceMax,
    positives: GENERIC_POSITIVES,
    risks: GENERIC_RISKS,
  };
}

function priceSweetSpotScore(priceMin: number, priceMax: number): number {
  const avg = (priceMin + priceMax) / 2;
  if (avg >= 15 && avg <= 60) return 90;
  if (avg >= 8 && avg < 100) return 70;
  return 45;
}

function pickRecommendation(score: number): Recommendation {
  if (score >= 75) return "Strong Opportunity";
  if (score >= 50) return "Possible Opportunity";
  return "High Risk";
}

export function analyzeProduct(rawQuery: string): AnalysisResult {
  const query = rawQuery.trim();
  const profile = findCategoryProfile(query) ?? buildFallbackProfile(query);
  const priceScore = priceSweetSpotScore(profile.priceMin, profile.priceMax);

  const opportunityScore = Math.round(
    profile.demand * 0.35 +
      profile.margin * 0.4 +
      (100 - profile.competition) * 0.1 +
      priceScore * 0.15
  );

  const positives: string[] = [];
  const risks: string[] = [];

  if (profile.demand >= 70) positives.push("High consumer demand");
  else if (profile.demand < 45) risks.push("Uncertain or low consumer demand");

  if (profile.margin >= 60) positives.push("Good margin potential");
  else if (profile.margin < 40) risks.push("Thin margins likely");

  if (profile.competition >= 70) risks.push("Competitive market");
  else if (profile.competition <= 45) positives.push("Low competition landscape");

  if (priceScore >= 90) positives.push("Price sits in a proven, high-converting range");
  else if (priceScore <= 45) risks.push("Price point outside the typical sweet spot");

  for (const extra of profile.positives) {
    if (positives.length >= 3) break;
    if (!positives.includes(extra)) positives.push(extra);
  }
  for (const extra of profile.risks) {
    if (risks.length >= 2) break;
    if (!risks.includes(extra)) risks.push(extra);
  }

  if (positives.length === 0) positives.push("No strong positive signals detected");
  if (risks.length === 0) risks.push("No major risks detected in this analysis");

  return {
    productName: titleCase(query),
    category: profile.category,
    opportunityScore,
    recommendation: pickRecommendation(opportunityScore),
    demand: profile.demand,
    competition: profile.competition,
    marginPotential: profile.margin,
    priceMin: profile.priceMin,
    priceMax: profile.priceMax,
    positives: positives.slice(0, 3),
    risks: risks.slice(0, 2),
  };
}
