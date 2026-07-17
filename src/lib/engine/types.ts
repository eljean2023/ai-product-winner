export type Recommendation =
  | "Strong Opportunity"
  | "Possible Opportunity"
  | "High Risk";

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
  positives: string[];
  risks: string[];
  // Convenience aliases kept for simple stat displays.
  demand: number;
  competition: number;
  marginPotential: number;
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
}

// Abstraction over "where market signal comes from". Today it's backed by
// the local heuristic engine; later it can be swapped for a provider that
// calls out to Amazon, Mercado Libre, or Google Trends without the UI
// changing at all — components only ever depend on this interface.
export interface MarketIntelligenceProvider {
  name: string;
  analyzeProduct(query: string): AnalysisResult;
  discoverOpportunities(query: string, limit?: number): ProductOpportunity[];
}
