// Deterministic "suggested selling angle" text. Built from the product's own
// title/category (real fields) plus its computed dimensions — never invents
// facts about the product, only suggests a positioning angle a new seller
// could test.
import { hashString } from "./hash";

const AUDIENCE_KEYWORDS: { pattern: RegExp; audience: string }[] = [
  { pattern: /\bsports?\b|running|\bgym\b|workout|athletic|training/i, audience: "fitness users" },
  { pattern: /gaming|gamer|esports/i, audience: "gamers" },
  { pattern: /kids?|children|toddler/i, audience: "parents shopping for kids" },
  { pattern: /travel|portable|compact|mini/i, audience: "frequent travelers" },
  { pattern: /office|work|professional|desk/i, audience: "remote and hybrid workers" },
  { pattern: /outdoor|camp|hiking/i, audience: "outdoor enthusiasts" },
  { pattern: /pet|dog|cat/i, audience: "pet owners" },
  { pattern: /baby|infant|nursery/i, audience: "new parents" },
];

const CATEGORY_AUDIENCE_FALLBACK: Record<string, string> = {
  Gaming: "gamers and streamers",
  Office: "remote and hybrid workers",
  Kitchen: "home cooks",
  Beauty: "beauty and self-care shoppers",
  Fitness: "fitness enthusiasts",
  Pet: "pet owners",
  Baby: "new parents",
  Fashion: "style-conscious shoppers",
  Automotive: "everyday drivers",
  Camping: "outdoor and camping enthusiasts",
  Garden: "home gardeners",
  Tools: "DIY and home-improvement buyers",
  Home: "home-improvement shoppers",
  Electronics: "everyday tech buyers",
  "General Merchandise": "everyday online shoppers",
};

function detectAudience(title: string, category: string): string {
  const hit = AUDIENCE_KEYWORDS.find((k) => k.pattern.test(title));
  if (hit) return hit.audience;
  return CATEGORY_AUDIENCE_FALLBACK[category] ?? "everyday online shoppers";
}

const BRANDED_POSITIONING = [
  "a lower-priced alternative that matches the core features",
  "a no-frills alternative at a fraction of the price",
  "a budget-friendly alternative for buyers priced out of the name brand",
];

const HIGH_MARGIN_POSITIONING = [
  "a premium, private-label version",
  "a higher-quality private-label option",
  "a differentiated, better-reviewed private-label version",
];

const GENERIC_POSITIONING = [
  "a differentiated private-label option",
  "a niche-focused private-label version",
  "a private-label version with clearer branding and packaging",
];

export function generateSellingAngle(
  title: string,
  category: string,
  branded: boolean,
  marginPotential: number,
  seed: string
): string {
  const audience = detectAudience(title, category);
  const pool = branded
    ? BRANDED_POSITIONING
    : marginPotential >= 60
      ? HIGH_MARGIN_POSITIONING
      : GENERIC_POSITIONING;
  const positioning = pool[hashString(`${seed}::angle`) % pool.length];
  return `Target ${audience} with ${positioning} of this product.`;
}
