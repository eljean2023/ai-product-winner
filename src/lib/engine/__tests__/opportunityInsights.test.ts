import { describe, expect, it } from "vitest";
import { computeRecommendation, generateOpportunityInsights, type InsightSubject } from "../opportunityInsights";
import type { DimensionScores } from "../types";

const BASE_DIMENSIONS: DimensionScores = {
  demand: 70,
  competition: 40,
  margin: 70,
  shippingComplexity: 30,
  supplierAvailability: 70,
  bundlePotential: 60,
  brandOpportunity: 70,
  repeatPurchase: 50,
  trendStability: 60,
  returnRisk: 30,
  marketSaturation: 40,
};

function dims(overrides: Partial<DimensionScores> = {}): DimensionScores {
  return { ...BASE_DIMENSIONS, ...overrides };
}

describe("computeRecommendation thresholds (AGENTS.md permanent — never loosen)", () => {
  it("requires opportunityScore >= 80 for Strong Opportunity", () => {
    expect(computeRecommendation({ opportunityScore: 79, dimensions: dims() })).not.toBe("Strong Opportunity");
    expect(computeRecommendation({ opportunityScore: 80, dimensions: dims() })).toBe("Strong Opportunity");
  });

  it("requires brandOpportunity >= 60 for Strong Opportunity", () => {
    expect(computeRecommendation({ opportunityScore: 85, dimensions: dims({ brandOpportunity: 59 }) })).toBe(
      "Possible Opportunity"
    );
    expect(computeRecommendation({ opportunityScore: 85, dimensions: dims({ brandOpportunity: 60 }) })).toBe(
      "Strong Opportunity"
    );
  });

  it("requires margin >= 60 for Strong Opportunity", () => {
    expect(computeRecommendation({ opportunityScore: 85, dimensions: dims({ margin: 59 }) })).toBe(
      "Possible Opportunity"
    );
    expect(computeRecommendation({ opportunityScore: 85, dimensions: dims({ margin: 60 }) })).toBe(
      "Strong Opportunity"
    );
  });

  it("requires competition <= 60 for Strong Opportunity", () => {
    expect(computeRecommendation({ opportunityScore: 85, dimensions: dims({ competition: 61 }) })).toBe(
      "Possible Opportunity"
    );
    expect(computeRecommendation({ opportunityScore: 85, dimensions: dims({ competition: 60 }) })).toBe(
      "Strong Opportunity"
    );
  });

  it("forces High Risk below opportunityScore 60 regardless of dimensions", () => {
    expect(computeRecommendation({ opportunityScore: 59, dimensions: dims() })).toBe("High Risk");
    expect(computeRecommendation({ opportunityScore: 60, dimensions: dims() })).not.toBe("High Risk");
  });

  it("forces High Risk when brandOpportunity < 25, even with a high score", () => {
    expect(computeRecommendation({ opportunityScore: 95, dimensions: dims({ brandOpportunity: 24 }) })).toBe(
      "High Risk"
    );
    expect(computeRecommendation({ opportunityScore: 95, dimensions: dims({ brandOpportunity: 25 }) })).not.toBe(
      "High Risk"
    );
  });

  it("forces High Risk when marketSaturation >= 85, even with a high score", () => {
    expect(computeRecommendation({ opportunityScore: 95, dimensions: dims({ marketSaturation: 85 }) })).toBe(
      "High Risk"
    );
    expect(computeRecommendation({ opportunityScore: 95, dimensions: dims({ marketSaturation: 84 }) })).not.toBe(
      "High Risk"
    );
  });
});

describe("generateOpportunityInsights — consultant behavior", () => {
  it("explains a brand-dominated product (Apple iPhone) and suggests accessory/private-label alternatives", () => {
    const subject: InsightSubject = {
      productName: "Apple iPhone 15",
      category: "Electronics",
      opportunityScore: 88,
      dimensions: dims({ brandOpportunity: 10, competition: 85 }),
    };

    const insights = generateOpportunityInsights(subject);

    expect(insights.recommendation).toBe("High Risk");
    expect(insights.summary).toContain("Apple");
    expect(insights.suggestedStrategy).toContain("Apple");
    expect(insights.alternatives.length).toBeGreaterThan(0);
    expect(insights.alternatives.some((a) => /accessor|complement|private-label/i.test(a))).toBe(true);
  });

  it("names the weakest dimensions for a plain low-score High Risk product", () => {
    const subject: InsightSubject = {
      productName: "Generic Widget",
      category: "General Merchandise",
      opportunityScore: 35,
      dimensions: dims({ margin: 10, demand: 15 }),
    };

    const insights = generateOpportunityInsights(subject);

    expect(insights.recommendation).toBe("High Risk");
    expect(insights.summary).toMatch(/Margin Potential|Demand Potential/);
    expect(insights.alternatives.length).toBeGreaterThan(0);
  });

  it("returns no alternatives for a non-High-Risk product", () => {
    const subject: InsightSubject = {
      productName: "Silicone Phone Case",
      category: "Electronics",
      opportunityScore: 85,
      dimensions: dims({ brandOpportunity: 70, margin: 65, competition: 50 }),
    };

    const insights = generateOpportunityInsights(subject);

    expect(insights.recommendation).toBe("Strong Opportunity");
    expect(insights.alternatives).toEqual([]);
  });
});
