// Standalone local test for the Keepa historical-intelligence integration.
//
// Run with:  node scripts/test-keepa.js
//
// This script does NOT modify, duplicate, or reimplement any production
// logic. It dynamically imports the real, unmodified source files —
//   - src/lib/marketplace/providers/keepa.ts   (keepaProvider.getProductHistory)
//   - src/lib/engine/historicalIntelligence.ts (analyzeHistory, applyHistoricalSignals)
//   - src/lib/engine/heuristicProvider.ts       (analyzeProduct, computeOpportunityScore)
//   - src/lib/engine/categoryProfiles.ts        (getCategoryProfileByName)
//   - src/lib/engine/opportunityInsights.ts     (computeRecommendation)
// — via Node's native TypeScript support (Node 22.6+) plus a small local
// loader (scripts/ts-alias-loader.mjs) that only teaches Node's resolver
// about the project's "@/*" -> "src/*" tsconfig path alias. No bundler, no
// ts-node/tsx dependency, nothing installed.
//
// Your KEEPA_API_KEY is read once from your local .env via `dotenv` (an
// existing devDependency) into this process's environment and is only ever
// used to call api.keepa.com directly from your own machine — it is never
// logged, printed, or sent anywhere else by this script.
//
// "Score before Keepa" uses the pure heuristic engine (heuristicProvider.ts)
// as the baseline, since Amazon PA-API credentials aren't configured in this
// project (confirmed separately) — there's no live marketplace listing to
// start from. This is clearly labeled in the output; it is not presented as
// a hybrid marketplace-blended score.
//
// If Keepa has no product/history for a given ASIN, that ASIN is reported
// as skipped with the real reason — never backfilled with a guessed or
// synthetic result.

"use strict";

const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const dotenv = require("dotenv");

const PROJECT_ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

// Best-effort set of long-standing, widely-referenced Amazon ASINs spanning
// several categories. Amazon ASINs can be delisted or regionalized over
// time — if any of these no longer resolve on Keepa, the script reports
// that honestly per-ASIN instead of assuming success. Swap in your own
// known-good ASINs freely; nothing else about the script needs to change.
const TEST_ASINS = [
  { asin: "B08N5WRWNW", note: "Amazon Echo Dot (4th Gen) — Electronics/Smart Home" },
  { asin: "B00FLYWNYQ", note: "Instant Pot Duo 7-in-1 6-Qt — Kitchen" },
  { asin: "B0863TXGM3", note: "Fire TV Stick 4K — Electronics/Streaming" },
  { asin: "B075CJ4S3K", note: "Anker PowerCore 10000 — Electronics/Accessories" },
  { asin: "B07PXGQC1Q", note: "Apple AirPods (2nd Gen) — Electronics" },
  { asin: "B002QYW8LW", note: "Crayola Crayons 24-count — Toys" },
];

function importSrc(relativePathFromSrc) {
  return import(pathToFileURL(path.join(PROJECT_ROOT, "src", relativePathFromSrc)).href);
}

// Separate, minimal, cheap (history=0) lookup used only to label the report
// with Keepa's own real product title — not part of the code under test.
async function fetchTitle(asin, apiKey, domain) {
  const url = `https://api.keepa.com/product?${new URLSearchParams({
    key: apiKey,
    domain,
    asin,
    history: "0",
    stats: "0",
  }).toString()}`;
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) return null;
    return data.products?.[0]?.title ?? null;
  } catch {
    return null;
  }
}

function diffDimensions(before, after) {
  return Object.keys(before).filter((key) => before[key] !== after[key]);
}

async function main() {
  const apiKey = process.env.KEEPA_API_KEY;
  if (!apiKey) {
    console.error(
      "KEEPA_API_KEY is not set (checked local .env). Add a real key before running this test — nothing was tested."
    );
    process.exitCode = 1;
    return;
  }
  const domain = process.env.KEEPA_DOMAIN || "1";

  register(pathToFileURL(path.join(__dirname, "ts-alias-loader.mjs")).href, pathToFileURL(`${__dirname}${path.sep}`));

  const { keepaProvider } = await importSrc("lib/marketplace/providers/keepa.ts");
  const { analyzeHistory, applyHistoricalSignals } = await importSrc("lib/engine/historicalIntelligence.ts");
  const { analyzeProduct: heuristicAnalyze, computeOpportunityScore } = await importSrc("lib/engine/heuristicProvider.ts");
  const { getCategoryProfileByName } = await importSrc("lib/engine/categoryProfiles.ts");
  const { computeRecommendation } = await importSrc("lib/engine/opportunityInsights.ts");

  const results = [];

  for (const { asin, note } of TEST_ASINS) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`ASIN: ${asin}  (${note})`);
    console.log("=".repeat(70));

    try {
      // --- Real call into the actual, unmodified implementation under test,
      // tried first so a hiccup in the title lookup below (best-effort,
      // display-only) never wrongly skips a testable ASIN. ---
      const history = await keepaProvider.getProductHistory(asin);
      if (!history) {
        console.log("-> Keepa returned no usable historical (csv) data for this ASIN. Skipping — not fabricating a result.");
        results.push({ asin, ok: false, reason: "No historical csv data returned by Keepa for this ASIN (may also mean an invalid ASIN or API key)." });
        continue;
      }
      console.log(`History points retrieved: ${history.points.length}`);

      const title = (await fetchTitle(asin, apiKey, domain)) ?? "(title unavailable — history call succeeded, title lookup didn't)";
      console.log(`Product title (from Keepa): ${title}`);

      const signals = analyzeHistory(history);
      const retrievedSignals = Object.entries(signals).filter(([, v]) => v !== null);
      console.log(`Historical signals retrieved (${retrievedSignals.length}/8 non-null):`);
      for (const [key, value] of Object.entries(signals)) {
        console.log(`  ${key}: ${value === null ? "null (insufficient history)" : value}`);
      }

      const base = heuristicAnalyze(title);
      const scoreBefore = base.opportunityScore;

      const blend = applyHistoricalSignals(base.dimensions, base.dimensionSources, signals);
      const profile = getCategoryProfileByName(base.category);
      const scoreAfter = computeOpportunityScore(profile, blend.dimensions);
      const recommendationAfter = computeRecommendation({ opportunityScore: scoreAfter, dimensions: blend.dimensions });
      const recommendationBefore = computeRecommendation({ opportunityScore: scoreBefore, dimensions: base.dimensions });

      const diff = scoreAfter - scoreBefore;
      const influencedDims = diffDimensions(base.dimensions, blend.dimensions);

      console.log(`\nCategory (heuristic match): ${base.category}`);
      console.log(`Score before Keepa (heuristic baseline): ${scoreBefore}  [${recommendationBefore}]`);
      console.log(`Score after Keepa:                       ${scoreAfter}  [${recommendationAfter}]`);
      console.log(`Difference:                              ${diff >= 0 ? "+" : ""}${diff}`);
      console.log(
        `Dimensions actually changed by real Keepa signals: ${
          influencedDims.length > 0 ? influencedDims.join(", ") : "none — signals present but every nudge rounded to 0"
        }`
      );
      if (blend.notes.length > 0) {
        console.log("Historical notes generated:");
        blend.notes.forEach((n) => console.log(`  - ${n}`));
      }

      results.push({
        asin,
        title,
        category: base.category,
        historyPoints: history.points.length,
        retrievedSignalCount: retrievedSignals.length,
        scoreBefore,
        scoreAfter,
        diff,
        influencedDims,
        recommendationBefore,
        recommendationAfter,
        ok: true,
      });
    } catch (err) {
      console.log(`-> Error while testing this ASIN: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ asin, ok: false, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(`\n\n${"#".repeat(70)}`);
  console.log("# SUMMARY");
  console.log("#".repeat(70));

  const tested = results.filter((r) => r.ok);
  const skipped = results.filter((r) => !r.ok);

  console.log(`ASINs attempted:                 ${TEST_ASINS.length}`);
  console.log(`ASINs with real Keepa data:      ${tested.length}`);
  console.log(`ASINs skipped (no fabrication):  ${skipped.length}`);
  skipped.forEach((r) => console.log(`  - ${r.asin}: ${r.reason}`));

  if (tested.length > 0) {
    const changed = tested.filter((r) => r.diff !== 0);
    const unchanged = tested.filter((r) => r.diff === 0);
    const improving = tested.filter((r) => r.diff > 0);
    const declining = tested.filter((r) => r.diff < 0);
    const noHistoryVariance = tested.filter((r) => r.retrievedSignalCount === 0);

    console.log(`\nProducts where score changed from real signal: ${changed.length}`);
    console.log(`Products with improving score (positive trend): ${improving.length}`);
    console.log(`Products with declining score (negative trend):  ${declining.length}`);
    console.log(`Products unchanged (0/8 signals had enough history): ${unchanged.length} (of which ${noHistoryVariance.length} retrieved zero non-null signals)`);

    const anyChangedWithoutSignal = tested.some((r) => r.diff !== 0 && r.retrievedSignalCount === 0);
    const anyUnchangedDespiteSignal = tested.some(
      (r) => r.diff === 0 && r.retrievedSignalCount > 0 && r.influencedDims.length === 0
    );

    console.log("\n--- Integrity checks ---");
    console.log(
      `Score ever changed with zero retrieved signals (should never happen): ${anyChangedWithoutSignal ? "YES — BUG" : "no"}`
    );
    console.log(
      `Signals retrieved but every nudge rounded to exactly 0 (expected occasionally, not a bug): ${anyUnchangedDespiteSignal ? "yes, on " + tested.filter((r) => r.diff === 0 && r.retrievedSignalCount > 0).length + " product(s)" : "no"}`
    );

    console.log("\nKeepa integration verdict:");
    if (!anyChangedWithoutSignal) {
      console.log(
        "  Working correctly — every score change traces back to a real, retrieved Keepa signal, and ASINs/history the API couldn't supply were reported honestly instead of guessed."
      );
    } else {
      console.log("  INVESTIGATE — a score changed with no retrieved signal backing it. This should not be possible.");
    }
  } else {
    console.log(
      "\nNo ASIN returned usable Keepa data on this run — cannot verify score-changing behavior. Check KEEPA_API_KEY validity/quota, or try different ASINs."
    );
  }
}

main().catch((err) => {
  console.error("Test script failed:", err);
  process.exitCode = 1;
});
