// Turns Keepa's raw point-in-time history (price, sales rank, rating,
// review count, Buy Box price, offer count — see ProductHistory in
// @/lib/marketplace/types) into bounded, named trend/stability signals the
// hybrid engine can blend into an already-scored product's dimensions.
//
// Every signal here is null when the underlying series doesn't have enough
// points to say anything meaningful — callers must skip the corresponding
// dimension nudge rather than blend in a zero/neutral guess, so a thinly
// tracked ASIN degrades to "no historical signal" instead of a fabricated
// one.
import type { ProductHistory, ProductHistoryPoint } from "@/lib/marketplace/types";
import { clamp } from "./scoringUtils";
import type { DataSource, DimensionKey, DimensionScores } from "./types";

export interface HistoricalSignals {
  // 1. Price trend — % change between the earlier and more recent half of
  // the tracked price series (positive = price has risen).
  priceTrendPct: number | null;
  // 6. Price stability — 0-100, 100 = price barely deviates from its mean.
  priceStability: number | null;
  // 7. Price volatility — 0-100, 100 = price direction reverses constantly
  // (distinct from stability: a smooth, steady decline is unstable but not
  // volatile; a price bouncing up and down every update is both).
  priceVolatility: number | null;
  // 2. Sales Rank trend — % improvement between the earlier and more recent
  // half (positive = rank number has dropped, i.e. demand improving).
  salesRankTrendPct: number | null;
  // 3. Review velocity — ratio of the recent-half review accumulation rate
  // to the full-series average rate (>1 = accelerating).
  reviewVelocityRatio: number | null;
  // 4. Buy Box price stability — same 0-100 shape as priceStability, applied
  // to the Buy Box series specifically (it moves independently of list
  // price under active price-war competition).
  buyBoxStability: number | null;
  // 5. Stock/supply-continuity risk — 0-100, derived from how often the
  // active "New" offer count series reads zero (Keepa's public /product
  // response has no dedicated timestamped in-stock/out-of-stock series, so
  // this is the closest verifiable proxy, not a true availability history).
  stockRisk: number | null;
  // 8. Composite historical demand trend, -100..100, combining sales-rank
  // trend and review velocity (positive = demand strengthening).
  demandTrend: number | null;
}

const EMPTY_SIGNALS: HistoricalSignals = {
  priceTrendPct: null,
  priceStability: null,
  priceVolatility: null,
  salesRankTrendPct: null,
  reviewVelocityRatio: null,
  buyBoxStability: null,
  stockRisk: null,
  demandTrend: null,
};

const MIN_POINTS_FOR_TREND = 4;
const MIN_POINTS_FOR_STABILITY = 4;
const MIN_POINTS_FOR_STOCK_RISK = 3;

function seriesOf(points: ProductHistoryPoint[], field: "price" | "salesRank" | "reviewCount" | "buyBoxPrice" | "offerCountNew") {
  return points
    .filter((p) => p[field] !== undefined)
    .map((p) => ({ t: p.timestamp, v: p[field] as number }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Earlier-half vs recent-half average comparison — robust to Keepa's
// irregular update cadence (unlike a fixed day-window split, this always
// has data on both sides as long as there are enough points at all).
function splitHalves<T>(series: T[]): { early: T[]; recent: T[] } {
  const mid = Math.floor(series.length / 2);
  return { early: series.slice(0, mid), recent: series.slice(mid) };
}

function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

function computePriceSignals(points: ProductHistoryPoint[]): Pick<HistoricalSignals, "priceTrendPct" | "priceStability" | "priceVolatility"> {
  const series = seriesOf(points, "price");
  if (series.length < MIN_POINTS_FOR_STABILITY) {
    return { priceTrendPct: null, priceStability: null, priceVolatility: null };
  }

  const values = series.map((p) => p.v);
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const priceStability = clamp(Math.round(100 - coefficientOfVariation * 200), 0, 100);

  let reversals = 0;
  for (let i = 1; i < values.length - 1; i++) {
    const prevDelta = values[i] - values[i - 1];
    const nextDelta = values[i + 1] - values[i];
    if (prevDelta !== 0 && nextDelta !== 0 && Math.sign(prevDelta) !== Math.sign(nextDelta)) reversals++;
  }
  const priceVolatility =
    values.length > 2 ? clamp(Math.round((reversals / (values.length - 2)) * 100), 0, 100) : 0;

  let priceTrendPct: number | null = null;
  if (series.length >= MIN_POINTS_FOR_TREND) {
    const { early, recent } = splitHalves(series);
    priceTrendPct = percentChange(average(early.map((p) => p.v)), average(recent.map((p) => p.v)));
  }

  return { priceTrendPct, priceStability, priceVolatility };
}

function computeSalesRankTrend(points: ProductHistoryPoint[]): number | null {
  const series = seriesOf(points, "salesRank");
  if (series.length < MIN_POINTS_FOR_TREND) return null;
  const { early, recent } = splitHalves(series);
  const earlyAvg = average(early.map((p) => p.v));
  const recentAvg = average(recent.map((p) => p.v));
  // Rank number dropping = demand improving, so this is the inverse of a
  // plain percent-change: "trend" here means "improvement", not "increase".
  const change = percentChange(earlyAvg, recentAvg);
  return change === null ? null : clamp(Math.round(-change), -100, 100);
}

function computeReviewVelocity(points: ProductHistoryPoint[]): number | null {
  const series = seriesOf(points, "reviewCount");
  if (series.length < MIN_POINTS_FOR_TREND) return null;

  const first = series[0];
  const last = series[series.length - 1];
  const totalDays = daysBetween(first.t, last.t);
  if (totalDays < 1) return null;
  const overallRate = (last.v - first.v) / totalDays;
  if (overallRate <= 0) return null;

  const { recent } = splitHalves(series);
  const recentFirst = recent[0];
  const recentLast = recent[recent.length - 1];
  const recentDays = daysBetween(recentFirst.t, recentLast.t);
  if (recentDays < 1) return null;
  const recentRate = (recentLast.v - recentFirst.v) / recentDays;

  return clamp(recentRate / overallRate, 0, 5);
}

function computeStability(points: ProductHistoryPoint[], field: "buyBoxPrice"): number | null {
  const series = seriesOf(points, field);
  if (series.length < MIN_POINTS_FOR_STABILITY) return null;
  const values = series.map((p) => p.v);
  const mean = average(values);
  if (mean <= 0) return null;
  const variance = average(values.map((v) => (v - mean) ** 2));
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return clamp(Math.round(100 - coefficientOfVariation * 200), 0, 100);
}

function computeStockRisk(points: ProductHistoryPoint[]): number | null {
  const series = seriesOf(points, "offerCountNew");
  if (series.length < MIN_POINTS_FOR_STOCK_RISK) return null;
  const zeroFraction = series.filter((p) => p.v <= 0).length / series.length;
  const mostRecentIsZero = series[series.length - 1].v <= 0;
  return clamp(Math.round(zeroFraction * 70 + (mostRecentIsZero ? 30 : 0)), 0, 100);
}

function computeDemandTrend(salesRankTrendPct: number | null, reviewVelocityRatio: number | null): number | null {
  if (salesRankTrendPct === null && reviewVelocityRatio === null) return null;
  const velocityScore = reviewVelocityRatio === null ? null : clamp((reviewVelocityRatio - 1) * 50, -50, 50);
  if (salesRankTrendPct !== null && velocityScore !== null) {
    return clamp(Math.round(salesRankTrendPct * 0.6 + velocityScore * 0.4), -100, 100);
  }
  return clamp(Math.round(salesRankTrendPct ?? velocityScore ?? 0), -100, 100);
}

export function analyzeHistory(history: ProductHistory | null): HistoricalSignals {
  if (!history || history.points.length === 0) return EMPTY_SIGNALS;

  const { priceTrendPct, priceStability, priceVolatility } = computePriceSignals(history.points);
  const salesRankTrendPct = computeSalesRankTrend(history.points);
  const reviewVelocityRatio = computeReviewVelocity(history.points);
  const buyBoxStability = computeStability(history.points, "buyBoxPrice");
  const stockRisk = computeStockRisk(history.points);
  const demandTrend = computeDemandTrend(salesRankTrendPct, reviewVelocityRatio);

  return {
    priceTrendPct,
    priceStability,
    priceVolatility,
    salesRankTrendPct,
    reviewVelocityRatio,
    buyBoxStability,
    stockRisk,
    demandTrend,
  };
}

export interface HistoricalBlendResult {
  dimensions: DimensionScores;
  sources: Partial<Record<DimensionKey, DataSource>>;
  notes: string[];
}

// Nudges an already-scored product's dimensions using real Keepa history —
// never recomputes the opportunity-score formula itself (see
// computeOpportunityScore in heuristicProvider.ts, reused unchanged by
// callers after this runs) and never touches recommendation thresholds (see
// computeRecommendation in opportunityInsights.ts, also reused unchanged).
// Every nudge is small and bounded, mirroring the existing bounded-nudge
// idiom already used elsewhere in the engine (e.g. rankBonus,
// competitionQualityAdjustment in productScoring.ts) — a single historical
// quirk on one ASIN should perturb a score, never dominate it. A dimension
// is only touched, and only marked "real" in `sources`, when its underlying
// signal was actually available.
export function applyHistoricalSignals(
  dimensions: DimensionScores,
  sources: Partial<Record<DimensionKey, DataSource>>,
  signals: HistoricalSignals
): HistoricalBlendResult {
  const next: DimensionScores = { ...dimensions };
  const nextSources = { ...sources };
  const notes: string[] = [];

  if (signals.demandTrend !== null) {
    next.demand = clamp(next.demand + clamp(Math.round(signals.demandTrend * 0.2), -20, 20), 0, 100);
    nextSources.demand = "real";
    if (Math.abs(signals.demandTrend) >= 15) {
      notes.push(
        signals.demandTrend > 0
          ? "Amazon sales rank and review growth have been trending up — validated demand momentum from real historical data."
          : "Amazon sales rank and review growth have been trending down over the tracked period — cooling demand signal."
      );
    }
  }

  if (signals.priceTrendPct !== null || signals.priceVolatility !== null) {
    const trendPart = signals.priceTrendPct !== null ? signals.priceTrendPct * 0.4 : 0;
    const volatilityPart = signals.priceVolatility !== null ? signals.priceVolatility * 0.15 : 0;
    const marginNudge = clamp(Math.round(trendPart - volatilityPart), -20, 20);
    if (marginNudge !== 0) {
      next.margin = clamp(next.margin + marginNudge, 0, 100);
      nextSources.margin = "real";
    }
  }

  if (signals.priceStability !== null || signals.buyBoxStability !== null) {
    const priceStabilityPart = signals.priceStability !== null ? (signals.priceStability - 50) * 0.4 : 0;
    const buyBoxStabilityPart = signals.buyBoxStability !== null ? (signals.buyBoxStability - 50) * 0.2 : 0;
    const stabilityNudge = clamp(Math.round(priceStabilityPart + buyBoxStabilityPart), -25, 25);
    if (stabilityNudge !== 0) {
      next.trendStability = clamp(next.trendStability + stabilityNudge, 0, 100);
      nextSources.trendStability = "real";
    }
  }

  if (signals.buyBoxStability !== null) {
    const competitionNudge = clamp(Math.round((50 - signals.buyBoxStability) * 0.3), -15, 15);
    if (competitionNudge !== 0) {
      next.competition = clamp(next.competition + competitionNudge, 0, 100);
      nextSources.competition = "real";
      if (competitionNudge >= 10) {
        notes.push("Buy Box price history shows frequent turnover — a sign of active price-war competition on this ASIN.");
      }
    }
  }

  if (signals.priceVolatility !== null && signals.priceVolatility > 0) {
    const returnRiskNudge = clamp(Math.round(signals.priceVolatility * 0.25), 0, 20);
    if (returnRiskNudge !== 0) {
      next.returnRisk = clamp(next.returnRisk + returnRiskNudge, 0, 100);
      nextSources.returnRisk = "real";
    }
  }

  if (signals.stockRisk !== null && signals.stockRisk > 0) {
    const supplierNudge = clamp(Math.round(-signals.stockRisk * 0.4), -25, 0);
    if (supplierNudge !== 0) {
      next.supplierAvailability = clamp(next.supplierAvailability + supplierNudge, 0, 100);
      nextSources.supplierAvailability = "real";
      if (signals.stockRisk >= 40) {
        notes.push("This ASIN's active offer count has repeatedly dropped to zero — a real stock/supply-continuity risk.");
      }
    }
  }

  return { dimensions: next, sources: nextSources, notes };
}
