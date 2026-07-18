// Public surface of the AI Product Intelligence Engine — the last stage
// before the UI in Marketplace Providers -> Unified Product Data Layer ->
// Intelligence Engine -> Opportunity Score -> UI. Components should only
// ever import from here, not from `heuristicProvider` or `hybridEngine`
// directly — that keeps the UI decoupled from the specific engine
// implementation. The hybrid engine blends the pure heuristic engine with
// live marketplace data pulled through @/lib/marketplace/registry, which is
// provider-independent by construction: SerpAPI, Mercado Libre, the direct
// Amazon PA-API, or any future provider (eBay, Keepa, Walmart, ...) are all
// just entries in that registry, never a hardcoded dependency here. Swapping
// the blend strategy later means changing the `marketIntelligence`
// assignment below; nothing in the UI has to move.
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
