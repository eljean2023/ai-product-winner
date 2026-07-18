import { describe, expect, it } from "vitest";
import { applyBrandAdjustment, computeMarketSaturation, reviewDemandSignal } from "../scoringUtils";
import type { DimensionScores } from "../types";

const DIMENSIONS: DimensionScores = {
  demand: 50,
  competition: 40,
  margin: 50,
  shippingComplexity: 50,
  supplierAvailability: 50,
  bundlePotential: 50,
  brandOpportunity: 60,
  repeatPurchase: 50,
  trendStability: 50,
  returnRisk: 50,
  marketSaturation: 50,
};

describe("reviewDemandSignal — review-volume-weighted rating bonus", () => {
  it("weighs the same high rating more heavily when backed by more reviews", () => {
    const lowVolumeBonus = reviewDemandSignal(2, 5)! - reviewDemandSignal(2, 3)!;
    const highVolumeBonus = reviewDemandSignal(1000, 5)! - reviewDemandSignal(1000, 3)!;
    expect(highVolumeBonus).toBeGreaterThan(lowVolumeBonus);
  });

  it("returns null when review count is unknown", () => {
    expect(reviewDemandSignal(undefined, 4.5)).toBeNull();
  });
});

describe("applyBrandAdjustment — market-concentration-scaled penalty", () => {
  it("matches the original flat penalty at the default (unknown) concentration", () => {
    const result = applyBrandAdjustment(DIMENSIONS, true);
    expect(result.brandOpportunity).toBe(9); // clamp(round(60 * 0.15), 3, 20)
    expect(result.competition).toBe(60); // 40 + 20
  });

  it("penalizes harder when the brand dominates most of the market", () => {
    const dominant = applyBrandAdjustment(DIMENSIONS, true, 1);
    const minor = applyBrandAdjustment(DIMENSIONS, true, 0);
    expect(dominant.competition).toBeGreaterThan(minor.competition);
    expect(dominant.brandOpportunity).toBeLessThanOrEqual(minor.brandOpportunity);
  });

  it("leaves dimensions untouched aside from brandOpportunity when not branded", () => {
    const result = applyBrandAdjustment(DIMENSIONS, false);
    expect(result.competition).toBe(DIMENSIONS.competition);
    expect(result.brandOpportunity).toBeGreaterThan(DIMENSIONS.brandOpportunity);
  });
});

describe("computeMarketSaturation", () => {
  it("increases with listing volume", () => {
    const low = computeMarketSaturation(5);
    const high = computeMarketSaturation(5000);
    expect(high).toBeGreaterThan(low);
  });

  it("increases when listings cluster tightly around the average price", () => {
    const tight = computeMarketSaturation(500, 19, 21, 20);
    const wide = computeMarketSaturation(500, 5, 100, 20);
    expect(tight).toBeGreaterThan(wide);
  });
});
