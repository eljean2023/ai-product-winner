import { describe, expect, it } from "vitest";
import type { MarketplaceListing } from "@/lib/marketplace/types";
import { computeRecommendation } from "../opportunityInsights";
import { scoreMarketplaceProduct, type MarketContext } from "../productScoring";

const LISTING: MarketplaceListing = {
  title: "Wireless Earbuds",
  price: 35,
  currency: "USD",
  url: "https://example.com/wireless-earbuds",
  rating: 4.5,
  reviewCount: 500,
  seller: "AudioCo",
  condition: "new",
  freeShipping: true,
};

const MARKET: MarketContext = {
  marketplace: "amazon",
  marketplaceName: "Amazon",
  totalListings: 200,
  totalSellers: 60,
  priceMin: 15,
  priceMax: 90,
  averagePrice: 35,
  currency: "USD",
};

describe("scoreMarketplaceProduct — dimensionSources honesty", () => {
  const product = scoreMarketplaceProduct(LISTING, MARKET);

  it("marks dimensions backed by real listing/market data as real", () => {
    expect(product.dimensionSources.demand).toBe("real");
    expect(product.dimensionSources.competition).toBe("real");
    expect(product.dimensionSources.marketSaturation).toBe("real");
    expect(product.dimensionSources.margin).toBe("real");
    expect(product.dimensionSources.returnRisk).toBe("real");
  });

  it("marks brand opportunity as a rule-based heuristic, not real data or a raw estimate", () => {
    expect(product.dimensionSources.brandOpportunity).toBe("heuristic");
  });

  it("marks dimensions with no real-world proxy as ai-estimate", () => {
    expect(product.dimensionSources.bundlePotential).toBe("ai-estimate");
    expect(product.dimensionSources.supplierAvailability).toBe("ai-estimate");
    expect(product.dimensionSources.repeatPurchase).toBe("ai-estimate");
    expect(product.dimensionSources.trendStability).toBe("ai-estimate");
  });

  it("falls back demand to ai-estimate when no review/rating signal exists", () => {
    const noReviewListing: MarketplaceListing = { ...LISTING, rating: undefined, reviewCount: undefined };
    const noReviewProduct = scoreMarketplaceProduct(noReviewListing, MARKET);
    expect(noReviewProduct.dimensionSources.demand).toBe("ai-estimate");
  });
});

describe("scoreMarketplaceProduct — recommendation consistency", () => {
  it("uses the same unified computeRecommendation logic as opportunityInsights", () => {
    const product = scoreMarketplaceProduct(LISTING, MARKET);
    expect(product.recommendation).toBe(
      computeRecommendation({ opportunityScore: product.opportunityScore, dimensions: product.dimensions })
    );
  });
});

describe("scoreMarketplaceProduct — market-concentration-scaled brand penalty", () => {
  const brandedListing: MarketplaceListing = { ...LISTING, title: "Apple AirPods Pro" };

  it("penalizes brandOpportunity harder when the brand dominates the market", () => {
    const dominatedMarket: MarketContext = { ...MARKET, brandConcentration: { apple: 0.95 } };
    const minorMarket: MarketContext = { ...MARKET, brandConcentration: { apple: 0.05 } };

    const dominated = scoreMarketplaceProduct(brandedListing, dominatedMarket);
    const minor = scoreMarketplaceProduct(brandedListing, minorMarket);

    expect(dominated.dimensions.brandOpportunity).toBeLessThanOrEqual(minor.dimensions.brandOpportunity);
    expect(dominated.dimensions.competition).toBeGreaterThanOrEqual(minor.dimensions.competition);
  });
});

describe("scoreMarketplaceProduct — competition quality signal", () => {
  it("raises competition when the competing set is rated very highly", () => {
    const highRatedMarket: MarketContext = { ...MARKET, averageRating: 4.9 };
    const lowRatedMarket: MarketContext = { ...MARKET, averageRating: 3.2 };

    const highRated = scoreMarketplaceProduct(LISTING, highRatedMarket);
    const lowRated = scoreMarketplaceProduct(LISTING, lowRatedMarket);

    expect(highRated.dimensions.competition).toBeGreaterThan(lowRated.dimensions.competition);
  });
});
