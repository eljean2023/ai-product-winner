import { analyzeProduct, type AnalysisResult, type Recommendation } from "./analyze";

export interface ProductOpportunity {
  productName: string;
  category: string;
  opportunityScore: number;
  recommendation: Recommendation;
  shortExplanation: string;
  demand: number;
  competition: number;
  marginPotential: number;
}

interface DiscoveryTopic {
  keywords: string[];
  candidates: string[];
}

// Curated candidate products per broad topic. This stands in for a live
// marketplace search (Amazon, Mercado Libre) until that integration exists —
// swap `candidates` for a live product-name lookup later without touching
// the scoring or UI layers.
const DISCOVERY_TOPICS: DiscoveryTopic[] = [
  {
    keywords: ["usb", "charger", "charging", "power bank", "cable"],
    candidates: [
      "USB-C Charger 30W",
      "USB-C to USB-C Braided Cable",
      "Multi-Port USB-C Charging Hub",
      "Wireless Power Bank 10000mAh",
      "USB-C Car Charger Adapter",
    ],
  },
  {
    keywords: ["kitchen", "cook", "cooking"],
    candidates: [
      "Mini Air Fryer 2L",
      "Stainless Steel Knife Set",
      "Bamboo Cutting Board Set",
      "Insulated Water Bottle 32oz",
      "Silicone Kitchen Gadget Set",
    ],
  },
  {
    keywords: ["gaming", "gamer", "game"],
    candidates: [
      "RGB Gaming Mouse",
      "Mechanical Gaming Keyboard",
      "Gaming Mousepad XL",
      "Webcam For Streaming",
      "Laptop Stand For Gaming Setup",
    ],
  },
  {
    keywords: ["pet", "dog", "cat"],
    candidates: [
      "Adjustable Dog Leash",
      "Orthopedic Pet Bed",
      "Interactive Cat Toy",
      "Pet Grooming Brush",
      "Automatic Pet Feeder",
    ],
  },
  {
    keywords: ["beauty", "skincare", "cosmetic", "makeup"],
    candidates: [
      "Vitamin C Facial Serum",
      "Ionic Hair Dryer",
      "Beauty Facial Cleansing Brush",
      "Makeup Organizer Case",
      "Jade Beauty Facial Roller",
    ],
  },
  {
    keywords: ["fitness", "gym", "workout", "exercise"],
    candidates: [
      "Non-Slip Yoga Mat",
      "Resistance Bands Set",
      "Adjustable Dumbbell Set",
      "Fitness Resistance Loop Bands",
      "Fitness Foam Roller",
    ],
  },
  {
    keywords: ["baby", "infant", "toddler", "nursery"],
    candidates: [
      "Baby Nursery Night Light",
      "Silicone Baby Feeding Set",
      "Baby Monitor With Camera",
      "Toddler Travel Backpack",
      "Baby Swaddle Blanket Set",
    ],
  },
  {
    keywords: ["camping", "outdoor", "hiking"],
    candidates: [
      "Portable Camping Lantern",
      "Compact Camping Hammock",
      "Waterproof Hiking Backpack",
      "Portable Camping Stove",
      "Camping Sleeping Pad",
    ],
  },
  {
    keywords: ["office", "desk", "work from home", "wfh"],
    candidates: [
      "Adjustable Monitor Stand",
      "LED Desk Lamp",
      "Office Desk Cable Organizer",
      "Office Ergonomic Wrist Rest",
      "Ring Light For Video Calls",
    ],
  },
];

// Used when the query doesn't match a topic, or the user has no idea what
// to sell yet — a broad sweep across every curated topic.
const DEFAULT_POOL = Array.from(
  new Set(DISCOVERY_TOPICS.flatMap((topic) => topic.candidates))
);

function matchTopics(query: string): DiscoveryTopic[] {
  const lower = query.toLowerCase();
  return DISCOVERY_TOPICS.filter((topic) =>
    topic.keywords.some((keyword) => lower.includes(keyword))
  );
}

function shortExplanationFor(result: AnalysisResult): string {
  return result.positives[0] ?? "Balanced demand and margin profile.";
}

export function discoverOpportunities(
  rawQuery: string,
  limit = 5
): ProductOpportunity[] {
  const query = rawQuery.trim();
  const matchedTopics = query ? matchTopics(query) : [];

  const candidatePool =
    matchedTopics.length > 0
      ? Array.from(new Set(matchedTopics.flatMap((topic) => topic.candidates)))
      : DEFAULT_POOL;

  const scored = candidatePool.map((name) => {
    const result = analyzeProduct(name);
    const opportunity: ProductOpportunity = {
      productName: result.productName,
      category: result.category,
      opportunityScore: result.opportunityScore,
      recommendation: result.recommendation,
      shortExplanation: shortExplanationFor(result),
      demand: result.demand,
      competition: result.competition,
      marginPotential: result.marginPotential,
    };
    return opportunity;
  });

  scored.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return scored.slice(0, limit);
}
