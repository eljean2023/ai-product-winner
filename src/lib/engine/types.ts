import type { MarketplaceSummary } from "@/lib/marketplace/types";

export type Recommendation =
  | "Strong Opportunity"
  | "Possible Opportunity"
  | "High Risk";

// Whether a result's score/price band reflects real marketplace data blended
// in, or is heuristic-only (no marketplace was available for this query).
export type DataConfidence = "hybrid" | "heuristic-only";

export type ConfidenceLevel = "High" | "Medium" | "Low";

// Where a single dimension's number actually came from, so the UI can be
// honest per-dimension instead of one blanket "hybrid"/"heuristic" label for
// the whole result:
// - "real": aggregated directly from live marketplace numbers (price,
//   rating, review count, listing/seller count).
// - "heuristic": a deterministic rule applied to real input (e.g. brand
//   keyword detection, category-band lookup).
// - "ai-estimate": no real per-product proxy exists yet, so it falls back to
//   a category-baseline estimate — these are exactly the dimensions Keepa
//   and the other planned signals (see AGENTS.md) will eventually replace.
export type DataSource = "real" | "heuristic" | "ai-estimate";

// Every product is scored across these independent dimensions. Dimensions
// marked as "risk" in RISK_DIMENSIONS are unfavorable at high values (e.g.
// Competition Risk); the rest are favorable at high values.
export type DimensionKey =
  | "demand"
  | "competition"
  | "margin"
  | "shippingComplexity"
  | "supplierAvailability"
  | "bundlePotential"
  | "brandOpportunity"
  | "repeatPurchase"
  | "trendStability"
  | "returnRisk"
  | "marketSaturation";

export const RISK_DIMENSIONS: DimensionKey[] = [
  "competition",
  "shippingComplexity",
  "returnRisk",
  "marketSaturation",
];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  demand: "Demand Potential",
  competition: "Competition Risk",
  margin: "Margin Potential",
  shippingComplexity: "Shipping Complexity",
  supplierAvailability: "Supplier Availability",
  bundlePotential: "Bundle Potential",
  brandOpportunity: "Brand Opportunity",
  repeatPurchase: "Repeat Purchase Potential",
  trendStability: "Trend Stability",
  returnRisk: "Return Risk",
  marketSaturation: "Market Saturation",
};

export type DimensionScores = Record<DimensionKey, number>;

export interface AnalysisResult {
  productName: string;
  category: string;
  opportunityScore: number;
  recommendation: Recommendation;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  dimensions: DimensionScores;
  // Per-dimension provenance — see DataSource. Optional keys default to
  // unknown/undocumented in the UI rather than a hard error.
  dimensionSources: Partial<Record<DimensionKey, DataSource>>;
  priceMin: number;
  priceMax: number;
  // Currency of priceMin/priceMax — "USD" for the heuristic estimate, or
  // whichever marketplace's currency the price band was overridden with.
  priceCurrency: string;
  positives: string[];
  risks: string[];
  // Convenience aliases kept for simple stat displays.
  demand: number;
  competition: number;
  marginPotential: number;
  // One-line positioning suggestion for a new seller/brand — deterministic,
  // derived from the product's own title/category, never invented.
  sellingAngle: string;
  // Real marketplace data blended into this result, one entry per provider
  // (Mercado Libre, Amazon, ...), each possibly `available: false`.
  marketplaceData: MarketplaceSummary[];
  dataConfidence: DataConfidence;
}

// A single real marketplace listing, scored. Every identifying field
// (title, price, imageUrl, permalink, ...) comes straight from the
// marketplace — the engine only ever adds the scoring fields on top, never
// invents or substitutes the product identity itself.
export interface ProductOpportunity {
  title: string;
  category: string;
  marketplace: MarketplaceSummary["marketplace"];
  marketplaceName: string;
  price: number;
  currency: string;
  imageUrl?: string;
  permalink: string;
  seller?: string;
  condition?: string;
  location?: string;
  freeShipping?: boolean;
  opportunityScore: number;
  recommendation: Recommendation;
  dimensions: DimensionScores;
  dimensionSources: Partial<Record<DimensionKey, DataSource>>;
  shortExplanation: string;
  sellingAngle: string;
  dataConfidence: DataConfidence;
}

export interface DiscoveryResult {
  products: ProductOpportunity[];
  // Set when there are zero products — either the marketplace isn't
  // connected, or a real search simply returned nothing. Never paired with
  // a non-empty products list.
  reason?: string;
}

export interface EngineOptions {
  // Mercado Libre country code (e.g. "MX", "AR", "BR"); resolved against
  // DEFAULT_ML_COUNTRY when omitted.
  country?: string;
}

// Abstraction over "where market signal comes from". Backed today by the
// hybrid engine (heuristics blended with live marketplace data); components
// only ever depend on this interface, never a specific provider.
export interface MarketIntelligenceProvider {
  name: string;
  analyzeProduct(query: string, opts?: EngineOptions): Promise<AnalysisResult>;
  discoverOpportunities(query: string, limit?: number, opts?: EngineOptions): Promise<DiscoveryResult>;
}
