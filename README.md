# AI Product Hunter

Find profitable products before investing money.

## What this is

A single-page tool: enter a product idea or keyword, get an opportunity
analysis back (category, demand, competition, price range, margin
potential, a 0-100 opportunity score, a recommendation, and plain-language
positive/risk signals).

## Current version (foundation)

The analysis in `src/lib/analyze.ts` is a rule-based heuristic — it
matches the keyword against a curated set of category profiles (audio
electronics, mobile accessories, computer peripherals, home & kitchen,
etc.) and scores demand, competition, margin potential, and price
positioning. Unmatched keywords fall back to a deterministic
"General Merchandise" estimate so the same input always produces the
same result. There is no external data source yet — this is intentional
scaffolding for the next phase.

## Planned integrations (not built yet)

- Mercado Libre listing/search data
- Amazon listing/search data
- Real competitor analysis
- Price tracking over time
- Product trend signals

Swapping in real data means replacing the body of `analyzeProduct()` in
`src/lib/analyze.ts` with live lookups; the page and result UI don't need
to change.

## Run it

```bash
npm install
npm run dev
```
