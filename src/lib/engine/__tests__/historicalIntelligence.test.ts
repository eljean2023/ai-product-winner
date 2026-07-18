import { describe, expect, it } from "vitest";
import { analyzeHistory, applyHistoricalSignals } from "../historicalIntelligence";
import type { DimensionScores } from "../types";
import type { ProductHistory, ProductHistoryPoint } from "@/lib/marketplace/types";

function history(points: ProductHistoryPoint[]): ProductHistory {
  return { id: "B000TEST01", marketplace: "amazon", points };
}

function iso(dayOffset: number): string {
  return new Date(2026, 0, 1 + dayOffset).toISOString();
}

const DIMENSIONS: DimensionScores = {
  demand: 50,
  competition: 50,
  margin: 50,
  shippingComplexity: 50,
  supplierAvailability: 50,
  bundlePotential: 50,
  brandOpportunity: 50,
  repeatPurchase: 50,
  trendStability: 50,
  returnRisk: 50,
  marketSaturation: 50,
};

describe("analyzeHistory — null-by-default on insufficient data", () => {
  it("returns every signal as null for a null history (no ASIN match / Keepa unavailable)", () => {
    const signals = analyzeHistory(null);
    expect(Object.values(signals).every((v) => v === null)).toBe(true);
  });

  it("returns every signal as null for an empty points array", () => {
    const signals = analyzeHistory(history([]));
    expect(Object.values(signals).every((v) => v === null)).toBe(true);
  });

  it("never fabricates a signal from a single price point", () => {
    const signals = analyzeHistory(history([{ timestamp: iso(0), price: 20 }]));
    expect(signals.priceTrendPct).toBeNull();
    expect(signals.priceStability).toBeNull();
  });
});

describe("analyzeHistory — price trend/stability/volatility", () => {
  it("detects a rising price trend between the earlier and recent half", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), price: 20 },
        { timestamp: iso(10), price: 20 },
        { timestamp: iso(20), price: 30 },
        { timestamp: iso(30), price: 30 },
      ])
    );
    expect(signals.priceTrendPct).toBeCloseTo(50, 0);
  });

  it("scores a flat price series as fully stable", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), price: 50 },
        { timestamp: iso(10), price: 50 },
        { timestamp: iso(20), price: 50 },
        { timestamp: iso(30), price: 50 },
      ])
    );
    expect(signals.priceStability).toBe(100);
    expect(signals.priceVolatility).toBe(0);
  });

  it("scores a wide-swinging price series as less stable than a flat one", () => {
    const swinging = analyzeHistory(
      history([
        { timestamp: iso(0), price: 10 },
        { timestamp: iso(10), price: 90 },
        { timestamp: iso(20), price: 10 },
        { timestamp: iso(30), price: 90 },
      ])
    );
    expect(swinging.priceStability).toBeLessThan(50);
  });

  it("gives a zigzagging price series higher volatility than a smooth monotonic trend", () => {
    const zigzag = analyzeHistory(
      history([
        { timestamp: iso(0), price: 10 },
        { timestamp: iso(10), price: 90 },
        { timestamp: iso(20), price: 10 },
        { timestamp: iso(30), price: 90 },
        { timestamp: iso(40), price: 10 },
      ])
    );
    const smooth = analyzeHistory(
      history([
        { timestamp: iso(0), price: 10 },
        { timestamp: iso(10), price: 20 },
        { timestamp: iso(20), price: 30 },
        { timestamp: iso(30), price: 40 },
        { timestamp: iso(40), price: 50 },
      ])
    );
    expect(zigzag.priceVolatility!).toBeGreaterThan(smooth.priceVolatility!);
  });
});

describe("analyzeHistory — sales rank, review velocity, demand trend", () => {
  it("reports a positive salesRankTrendPct when the rank number improves (drops)", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), salesRank: 5000 },
        { timestamp: iso(10), salesRank: 5000 },
        { timestamp: iso(20), salesRank: 2000 },
        { timestamp: iso(30), salesRank: 2000 },
      ])
    );
    expect(signals.salesRankTrendPct).toBeGreaterThan(0);
  });

  it("reports a negative salesRankTrendPct when the rank number worsens (rises)", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), salesRank: 2000 },
        { timestamp: iso(10), salesRank: 2000 },
        { timestamp: iso(20), salesRank: 5000 },
        { timestamp: iso(30), salesRank: 5000 },
      ])
    );
    expect(signals.salesRankTrendPct).toBeLessThan(0);
  });

  it("reports a review velocity ratio above 1 when reviews are accelerating", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), reviewCount: 100 },
        { timestamp: iso(10), reviewCount: 110 },
        { timestamp: iso(30), reviewCount: 150 },
        { timestamp: iso(40), reviewCount: 200 },
      ])
    );
    expect(signals.reviewVelocityRatio!).toBeGreaterThan(1);
  });

  it("combines sales rank and review velocity into a positive composite demand trend when both improve", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), salesRank: 5000 },
        { timestamp: iso(10), salesRank: 5000 },
        { timestamp: iso(20), salesRank: 2000 },
        { timestamp: iso(30), salesRank: 2000 },
        { timestamp: iso(0), reviewCount: 100 },
        { timestamp: iso(10), reviewCount: 110 },
        { timestamp: iso(30), reviewCount: 150 },
        { timestamp: iso(40), reviewCount: 200 },
      ])
    );
    expect(signals.demandTrend!).toBeGreaterThan(0);
  });
});

describe("analyzeHistory — stock risk", () => {
  it("scores high risk when the offer count repeatedly reads zero, especially most recently", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), offerCountNew: 5 },
        { timestamp: iso(10), offerCountNew: 3 },
        { timestamp: iso(20), offerCountNew: 0 },
        { timestamp: iso(30), offerCountNew: 0 },
        { timestamp: iso(40), offerCountNew: 0 },
      ])
    );
    expect(signals.stockRisk).toBe(72); // zeroFraction 3/5 * 70 + mostRecentIsZero 30 = 42 + 30
  });

  it("scores zero risk when offers are always available", () => {
    const signals = analyzeHistory(
      history([
        { timestamp: iso(0), offerCountNew: 5 },
        { timestamp: iso(10), offerCountNew: 6 },
        { timestamp: iso(20), offerCountNew: 4 },
      ])
    );
    expect(signals.stockRisk).toBe(0);
  });
});

describe("applyHistoricalSignals — bounded, gated dimension nudges", () => {
  it("leaves every dimension and source untouched when every signal is null", () => {
    const result = applyHistoricalSignals(DIMENSIONS, {}, {
      priceTrendPct: null,
      priceStability: null,
      priceVolatility: null,
      salesRankTrendPct: null,
      reviewVelocityRatio: null,
      buyBoxStability: null,
      stockRisk: null,
      demandTrend: null,
    });
    expect(result.dimensions).toEqual(DIMENSIONS);
    expect(result.sources).toEqual({});
    expect(result.notes).toEqual([]);
  });

  it("nudges demand upward and marks it real when demandTrend is positive", () => {
    const result = applyHistoricalSignals(DIMENSIONS, {}, {
      priceTrendPct: null,
      priceStability: null,
      priceVolatility: null,
      salesRankTrendPct: null,
      reviewVelocityRatio: null,
      buyBoxStability: null,
      stockRisk: null,
      demandTrend: 50,
    });
    expect(result.dimensions.demand).toBe(60); // 50 + clamp(round(50*0.2), -20, 20)
    expect(result.sources.demand).toBe("real");
  });

  it("never pushes a dimension outside 0-100 even at extreme signal values", () => {
    const nearMax: DimensionScores = { ...DIMENSIONS, demand: 95, supplierAvailability: 5 };
    const result = applyHistoricalSignals(nearMax, {}, {
      priceTrendPct: null,
      priceStability: null,
      priceVolatility: null,
      salesRankTrendPct: null,
      reviewVelocityRatio: null,
      buyBoxStability: null,
      stockRisk: 100,
      demandTrend: 100,
    });
    expect(result.dimensions.demand).toBeLessThanOrEqual(100);
    expect(result.dimensions.supplierAvailability).toBeGreaterThanOrEqual(0);
  });

  it("only reduces supplierAvailability from stock risk, never increases it", () => {
    const result = applyHistoricalSignals(DIMENSIONS, {}, {
      priceTrendPct: null,
      priceStability: null,
      priceVolatility: null,
      salesRankTrendPct: null,
      reviewVelocityRatio: null,
      buyBoxStability: null,
      stockRisk: 80,
      demandTrend: null,
    });
    expect(result.dimensions.supplierAvailability).toBeLessThan(DIMENSIONS.supplierAvailability);
    expect(result.sources.supplierAvailability).toBe("real");
  });
});
