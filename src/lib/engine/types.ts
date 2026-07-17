import type { MarketplaceSummary } from "@/lib/marketplace/types";

export type Recommendation =
  | "Strong Opportunity"
  | "Possible Opportunity"
  | "High Risk";

// Whether a result's score/price band reflects real marketplace data blended
// in, or is heuristic-only (no marketplace was available for this query).
export type DataConfidence = "hybrid" | "heuristic-only";

export type ConfidenceLevel = "High" | "Medium" | "Low";

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
  | "returnRisk";

export const RISK_DIMENSIONS: DimensionKey[] = [
  "competition",
  "shippingComplexity",
  "returnRisk",
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
  // Real marketplace data blended into this result, one entry per provider
  // (Mercado Libre, Amazon, ...), each possibly `available: false`.
  marketplaceData: MarketplaceSummary[];
  dataConfidence: DataConfidence;
}

export interface ProductOpportunity {
  productName: string;
  category: string;
  opportunityScore: number;
  recommendation: Recommendation;
  shortExplanation: string;
  demand: number;
  competition: number;
  marginPotential: number;
  priceMin: number;
  priceMax: number;
  priceCurrency: string;
  imageUrl?: string;
  marketplaceData: MarketplaceSummary[];
  dataConfidence: DataConfidence;
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
  discoverOpportunities(query: string, limit?: number, opts?: EngineOptions): Promise<ProductOpportunity[]>;
}
