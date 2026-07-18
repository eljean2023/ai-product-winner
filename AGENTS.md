<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Recommendation engine: conservative by permanent design

`src/lib/engine/opportunityInsights.ts` turns scores into seller-facing recommendations using deliberately strict thresholds:

- **Strong Opportunity**: `opportunityScore >= 80` AND `brandOpportunity >= 60` AND `margin >= 60` AND `competition <= 60`
- **Possible Opportunity**: `opportunityScore` 60–79
- **High Risk**: `opportunityScore < 60`, OR brand-dominated (`brandOpportunity < 25`), OR `marketSaturation >= 85`

**These thresholds must never be loosened to reduce the number of "High Risk" results.** This is a permanent architectural principle, not a temporary calibration: it is better to reject a mediocre product than to recommend a poor investment, and a conservative recommendation system builds more trust than an optimistic one.

If verification ever shows too many products landing on "High Risk" (or too few reaching "Strong Opportunity"), **the fix is to improve the scoring engine's inputs** — never to lower these thresholds. Score quality should evolve until genuinely strong opportunities naturally exceed 80+ on their own merits.

**Implemented** — Keepa historical intelligence (`src/lib/marketplace/providers/keepa.ts` decodes the raw series, `src/lib/engine/historicalIntelligence.ts` derives signals and blends them into dimensions, wired into both `analyzeProduct` and `discoverOpportunities` in `hybridEngine.ts`): price history/trend, price stability, price volatility, Sales Rank trend, review velocity, Buy Box price stability, and a stock/supply-continuity proxy (derived from active-offer-count continuity — Keepa's public `/product` endpoint has no dedicated timestamped in-stock/out-of-stock series). Amazon-only (Keepa is keyed by ASIN); every signal is null-gated on the underlying series having enough points, never fabricated.

Still-planned signal improvements for `heuristicProvider.ts` / `productScoring.ts` / `hybridEngine.ts` / `categoryProfiles.ts` include:

- Estimated monthly sales
- Seller concentration
- Marketplace diversity

Any future work on this engine — by any agent, in any session — must treat this section as binding.
