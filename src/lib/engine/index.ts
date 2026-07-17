// Public surface of the intelligence layer. Components should only ever
// import from here, not from `heuristicProvider` directly — that keeps the
// UI decoupled from the specific engine implementation. Swapping in a
// provider backed by live marketplace data later (Amazon, Mercado Libre,
// Google Trends) means implementing MarketIntelligenceProvider and changing
// the `marketIntelligence` assignment below; nothing in the UI has to move.
import { heuristicProvider } from "./heuristicProvider";
import type { MarketIntelligenceProvider } from "./types";

export const marketIntelligence: MarketIntelligenceProvider = heuristicProvider;

export function analyzeProduct(query: string) {
  return marketIntelligence.analyzeProduct(query);
}

export function discoverOpportunities(query: string, limit?: number) {
  return marketIntelligence.discoverOpportunities(query, limit);
}

export type {
  AnalysisResult,
  ConfidenceLevel,
  DimensionKey,
  DimensionScores,
  MarketIntelligenceProvider,
  ProductOpportunity,
  Recommendation,
} from "./types";
export { DIMENSION_LABELS, RISK_DIMENSIONS } from "./types";
