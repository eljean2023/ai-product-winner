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

If verification ever shows too many products landing on "High Risk" (or too few reaching "Strong Opportunity"), **the fix is to improve the scoring engine's inputs** — never to lower these thresholds. Score quality should evolve until genuinely strong opportunities naturally exceed 80+ on their own merits. Planned signal improvements for `heuristicProvider.ts` / `productScoring.ts` / `hybridEngine.ts` / `categoryProfiles.ts` include:

- Keepa historical price data
- Sales Rank
- Estimated monthly sales
- Price history / trend history
- Seller concentration
- Review velocity
- Buy Box information
- Marketplace diversity

Any future work on this engine — by any agent, in any session — must treat this section as binding.
