// The regression guard for the recommendation-engine unification: before
// this, heuristicProvider/productScoring/hybridEngine each called their own
// pickRecommendation(score) (75/50 cutoffs) while opportunityInsights had a
// separate, stricter computeRecommendation (80/60/60/60 + brand/saturation
// gates) — the same product could show two different verdicts. Every engine
// path must now agree with computeRecommendation applied to its own output.
import { describe, expect, it, vi } from "vitest";
import type { MarketplaceListing, MarketplaceSummary } from "@/lib/marketplace/types";
import { analyzeProduct as heuristicAnalyze } from "../heuristicProvider";
import { computeRecommendation } from "../opportunityInsights";
import { scoreMarketplaceProduct, type MarketContext } from "../productScoring";

const QUERIES = [
  "wireless earbuds",
  "apple iphone 15",
  "ergonomic office chair with footrest",
  "gaming mouse",
  "generic no-name widget",
];

describe("heuristicProvider.analyzeProduct agrees with computeRecommendation", () => {
  for (const query of QUERIES) {
    it(`for "${query}"`, () => {
      const result = heuristicAnalyze(query);
      expect(result.recommendation).toBe(
        computeRecommendation({ opportunityScore: result.opportunityScore, dimensions: result.dimensions })
      );
    });
  }
});

describe("productScoring.scoreMarketplaceProduct agrees with computeRecommendation", () => {
  const market: MarketContext = {
    marketplace: "ebay",
    marketplaceName: "eBay",
    totalListings: 400,
    totalSellers: 120,
    priceMin: 10,
    priceMax: 200,
    averagePrice: 45,
    currency: "USD",
  };

  const listings: MarketplaceListing[] = [
    { title: "Apple iPhone 15 Pro", price: 999, currency: "USD", url: "https://example.com/1", rating: 4.8, reviewCount: 9000 },
    { title: "No-Name Phone Case", price: 8, currency: "USD", url: "https://example.com/2", rating: 3.1, reviewCount: 4 },
    { title: "Ergonomic Standing Desk", price: 220, currency: "USD", url: "https://example.com/3", rating: 4.6, reviewCount: 800 },
  ];

  for (const listing of listings) {
    it(`for "${listing.title}"`, () => {
      const product = scoreMarketplaceProduct(listing, market);
      expect(product.recommendation).toBe(
        computeRecommendation({ opportunityScore: product.opportunityScore, dimensions: product.dimensions })
      );
    });
  }
});

describe("hybridEngine.analyzeProduct agrees with computeRecommendation", () => {
  it("for a branded query blended with real marketplace data", async () => {
    vi.resetModules();
    vi.doMock("@/lib/marketplace/registry", () => ({
      searchAllMarketplaces: async (): Promise<MarketplaceSummary[]> => [
        {
          marketplace: "amazon",
          marketplaceName: "Amazon",
          available: true,
          query: "apple iphone 15",
          listingCount: 5000,
          averagePrice: 999,
          minPrice: 799,
          maxPrice: 1299,
          currency: "USD",
          sellerCount: 40,
          averageRating: 4.7,
          listings: [],
        },
      ],
    }));

    const { analyzeProduct } = await import("../hybridEngine");
    const result = await analyzeProduct("apple iphone 15");

    expect(result.recommendation).toBe(
      computeRecommendation({ opportunityScore: result.opportunityScore, dimensions: result.dimensions })
    );

    vi.doUnmock("@/lib/marketplace/registry");
    vi.resetModules();
  });
});
