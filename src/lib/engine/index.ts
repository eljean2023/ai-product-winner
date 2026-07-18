// Public surface of the intelligence layer. Components should only ever
// import from here, not from `heuristicProvider` or `hybridEngine` directly
// — that keeps the UI decoupled from the specific engine implementation.
// The hybrid engine blends the pure heuristic engine with live marketplace
// data (Mercado Libre, Amazon, ...); swapping in a different blend strategy
// later means changing the `marketIntelligence` assignment below, nothing
// in the UI has to move.
import { hybridProvider } from "./hybridEngine";
import type { EngineOptions, MarketIntelligenceProvider } from "./types";

export const marketIntelligence: MarketIntelligenceProvider = hybridProvider;

export function analyzeProduct(query: string, opts?: EngineOptions) {
  return marketIntelligence.analyzeProduct(query, opts);
}

export function discoverOpportunities(query: string, limit?: number, opts?: EngineOptions) {
  return marketIntelligence.discoverOpportunities(query, limit, opts);
}

export { generateOpportunityInsights } from "./opportunityInsights";
export type { OpportunityInsights } from "./opportunityInsights";

export type {
  AnalysisResult,
  ConfidenceLevel,
  DataConfidence,
  DataSource,
  DimensionKey,
  DimensionScores,
  DiscoveryResult,
  EngineOptions,
  MarketIntelligenceProvider,
  ProductOpportunity,
  Recommendation,
} from "./types";
export { DIMENSION_LABELS, RISK_DIMENSIONS } from "./types";
