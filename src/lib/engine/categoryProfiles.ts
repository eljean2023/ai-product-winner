import type { DimensionKey } from "./types";

export interface DimensionRange {
  min: number;
  max: number;
}

export interface CategoryProfile {
  category: string;
  keywords: string[];
  // Realistic min-max band per dimension; a product's exact value is drawn
  // deterministically from within this band based on its name.
  ranges: Record<DimensionKey, DimensionRange>;
  // How much each dimension contributes to the opportunity score. Weights
  // sum to 1 per category, and differ by category on purpose — bundle
  // potential matters a lot for earbuds, shipping complexity matters a lot
  // for office chairs.
  weights: Record<DimensionKey, number>;
  priceFloor: number;
  priceCeiling: number;
  // Category-flavored talking points, mixed in with quantified per-product
  // reasoning so explanations never read as pure boilerplate.
  flavorPositives: string[];
  flavorRisks: string[];
  candidates: string[];
}

function r(min: number, max: number): DimensionRange {
  return { min, max };
}

export const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    category: "Gaming",
    keywords: [
      "gaming mouse", "gaming chair", "gaming headset", "gaming keyboard",
      "mechanical keyboard", "gaming mousepad", "mousepad", "game controller",
      "controller", "webcam", "mouse", "keyboard", "gaming",
    ],
    ranges: {
      demand: r(50, 75), competition: r(55, 80), margin: r(45, 70),
      shippingComplexity: r(20, 40), supplierAvailability: r(55, 85),
      bundlePotential: r(55, 80), brandOpportunity: r(40, 65),
      repeatPurchase: r(30, 50), trendStability: r(40, 65), returnRisk: r(35, 55),
    },
    weights: {
      demand: 0.16, competition: 0.12, margin: 0.15, shippingComplexity: 0.05,
      supplierAvailability: 0.06, bundlePotential: 0.14, brandOpportunity: 0.08,
      repeatPurchase: 0.08, trendStability: 0.08, returnRisk: 0.08,
    },
    priceFloor: 12, priceCeiling: 90,
    flavorPositives: [
      "Enthusiast buyers research heavily and are willing to pay for perceived quality",
      "Pairs naturally with streaming and content-creator audiences",
      "RGB and customization variants create easy product-line extensions",
    ],
    flavorRisks: [
      "Requires ongoing feature differentiation as specs become commoditized",
      "Enthusiast reviewers are quick to call out cheap build quality",
    ],
    candidates: [
      "RGB Gaming Mouse", "Mechanical Gaming Keyboard", "Gaming Headset With Mic",
      "Gaming Mousepad XL", "Controller Charging Dock", "Webcam For Streaming",
    ],
  },
  {
    category: "Office",
    keywords: [
      "office chair", "ergonomic chair", "desk organizer", "office",
      "led strip", "ring light", "monitor stand", "desk lamp",
      "standing desk", "wrist rest", "desk",
    ],
    ranges: {
      demand: r(40, 65), competition: r(30, 55), margin: r(40, 65),
      shippingComplexity: r(55, 85), supplierAvailability: r(45, 70),
      bundlePotential: r(15, 40), brandOpportunity: r(35, 60),
      repeatPurchase: r(15, 35), trendStability: r(45, 70), returnRisk: r(25, 45),
    },
    weights: {
      demand: 0.13, competition: 0.07, margin: 0.20, shippingComplexity: 0.16,
      supplierAvailability: 0.07, bundlePotential: 0.05, brandOpportunity: 0.07,
      repeatPurchase: 0.07, trendStability: 0.10, returnRisk: 0.08,
    },
    priceFloor: 25, priceCeiling: 280,
    flavorPositives: [
      "Work-from-home buyers are willing to pay for comfort and ergonomics",
      "Higher average ticket size means fewer sales are needed to hit revenue goals",
      "B2B and bulk-office buyers add a second demand channel",
    ],
    flavorRisks: [
      "Bulky items mean higher freight and higher damage-in-transit rates",
      "Assembly complexity can drive negative reviews if instructions are unclear",
    ],
    candidates: [
      "Ergonomic Office Chair with Footrest", "Adjustable Monitor Stand",
      "LED Desk Lamp", "Office Desk Cable Organizer", "Standing Desk Converter",
      "Wrist Rest Keyboard Pad",
    ],
  },
  {
    category: "Kitchen",
    keywords: [
      "kitchen organizer", "kitchen gadget", "kitchen", "air fryer",
      "knife set", "cutting board", "water bottle", "blender", "cookware",
      "food storage",
    ],
    ranges: {
      demand: r(55, 80), competition: r(45, 70), margin: r(55, 80),
      shippingComplexity: r(15, 35), supplierAvailability: r(70, 95),
      bundlePotential: r(45, 70), brandOpportunity: r(40, 65),
      repeatPurchase: r(65, 90), trendStability: r(45, 70), returnRisk: r(15, 35),
    },
    weights: {
      demand: 0.14, competition: 0.08, margin: 0.20, shippingComplexity: 0.05,
      supplierAvailability: 0.07, bundlePotential: 0.10, brandOpportunity: 0.06,
      repeatPurchase: 0.20, trendStability: 0.05, returnRisk: 0.05,
    },
    priceFloor: 10, priceCeiling: 60,
    flavorPositives: [
      "Broad, mainstream appeal across nearly every household",
      "Frequently gifted and re-bought as items wear out",
      "Simple, durable goods with low defect rates",
    ],
    flavorRisks: [
      "Seasonal demand swings around holidays and New Year organizing trends",
      "Crowded with near-identical private-label listings",
    ],
    candidates: [
      "Kitchen Drawer Organizer", "Mini Air Fryer 2L", "Bamboo Cutting Board Set",
      "Stainless Steel Knife Set", "Reusable Silicone Food Bags",
      "Insulated Water Bottle 32oz",
    ],
  },
  {
    category: "Beauty",
    keywords: [
      "skincare", "serum", "makeup", "hair dryer", "beauty", "cosmetic",
      "facial", "hair straightener", "makeup mirror",
    ],
    ranges: {
      demand: r(65, 90), competition: r(75, 95), margin: r(55, 80),
      shippingComplexity: r(15, 35), supplierAvailability: r(60, 90),
      bundlePotential: r(55, 80), brandOpportunity: r(55, 80),
      repeatPurchase: r(65, 90), trendStability: r(35, 60), returnRisk: r(25, 45),
    },
    weights: {
      demand: 0.15, competition: 0.10, margin: 0.22, shippingComplexity: 0.04,
      supplierAvailability: 0.05, bundlePotential: 0.10, brandOpportunity: 0.10,
      repeatPurchase: 0.16, trendStability: 0.05, returnRisk: 0.03,
    },
    priceFloor: 8, priceCeiling: 45,
    flavorPositives: [
      "Consumable products drive predictable repurchase cycles",
      "Private-label and custom formulation options support real brand building",
      "Strong visual/social appeal supports organic content marketing",
    ],
    flavorRisks: [
      "Highly saturated market dominated by influencer-backed brands",
      "Labeling and ingredient-disclosure requirements add compliance overhead",
    ],
    candidates: [
      "Vitamin C Facial Serum", "Ionic Hair Dryer", "Facial Cleansing Brush",
      "Jade Facial Roller", "LED Makeup Mirror", "Silk Hair Wrap Towel",
    ],
  },
  {
    category: "Fitness",
    keywords: [
      "yoga mat", "resistance band", "fitness", "gym", "dumbbell", "workout",
      "foam roller", "jump rope",
    ],
    ranges: {
      demand: r(55, 80), competition: r(55, 80), margin: r(45, 70),
      shippingComplexity: r(35, 65), supplierAvailability: r(55, 85),
      bundlePotential: r(50, 75), brandOpportunity: r(45, 70),
      repeatPurchase: r(35, 55), trendStability: r(30, 55), returnRisk: r(20, 40),
    },
    weights: {
      demand: 0.16, competition: 0.10, margin: 0.18, shippingComplexity: 0.08,
      supplierAvailability: 0.06, bundlePotential: 0.10, brandOpportunity: 0.08,
      repeatPurchase: 0.10, trendStability: 0.08, returnRisk: 0.06,
    },
    priceFloor: 10, priceCeiling: 55,
    flavorPositives: [
      "Health and wellness spending has trended upward for years",
      "Community and challenge-driven marketing angles are readily available",
      "Durable goods with low return and defect rates",
    ],
    flavorRisks: [
      "Demand spikes hard around New Year resolutions, then cools sharply",
      "Space is flooded with resolution-season sellers every January",
    ],
    candidates: [
      "Non-Slip Yoga Mat", "Resistance Bands Set", "Adjustable Dumbbell Set",
      "Foam Roller", "Jump Rope Speed Cable", "Fitness Resistance Loop Bands",
    ],
  },
  {
    category: "Pet",
    keywords: [
      "dog", "cat", "pet toy", "pet bed", "pet feeder", "pet grooming",
      "leash", "pet",
    ],
    ranges: {
      demand: r(45, 75), competition: r(35, 60), margin: r(45, 70),
      shippingComplexity: r(10, 30), supplierAvailability: r(55, 85),
      bundlePotential: r(55, 80), brandOpportunity: r(45, 70),
      repeatPurchase: r(55, 80), trendStability: r(25, 50), returnRisk: r(20, 40),
    },
    weights: {
      demand: 0.14, competition: 0.08, margin: 0.16, shippingComplexity: 0.06,
      supplierAvailability: 0.07, bundlePotential: 0.15, brandOpportunity: 0.08,
      repeatPurchase: 0.16, trendStability: 0.05, returnRisk: 0.05,
    },
    priceFloor: 9, priceCeiling: 40,
    flavorPositives: [
      "Loyal, repeat-buying customer base that treats pets like family",
      "Strong impulse-buy potential at checkout and in bundles",
      "Less price-sensitive niche than general consumer goods",
    ],
    flavorRisks: [
      "Sizing and fit variations across breeds increase returns",
      "Seasonal gifting spikes around holidays, quieter the rest of the year",
    ],
    candidates: [
      "Adjustable Dog Leash", "Orthopedic Pet Bed", "Interactive Cat Toy",
      "Automatic Pet Feeder", "Pet Grooming Brush", "Dog Puzzle Toy",
    ],
  },
  {
    category: "Baby",
    keywords: [
      "baby", "infant", "toddler", "nursery", "kids toy", "swaddle",
    ],
    ranges: {
      demand: r(45, 70), competition: r(40, 65), margin: r(40, 65),
      shippingComplexity: r(30, 55), supplierAvailability: r(45, 70),
      bundlePotential: r(45, 70), brandOpportunity: r(30, 55),
      repeatPurchase: r(40, 65), trendStability: r(50, 75), returnRisk: r(35, 55),
    },
    weights: {
      demand: 0.13, competition: 0.08, margin: 0.15, shippingComplexity: 0.07,
      supplierAvailability: 0.07, bundlePotential: 0.10, brandOpportunity: 0.09,
      repeatPurchase: 0.11, trendStability: 0.09, returnRisk: 0.11,
    },
    priceFloor: 12, priceCeiling: 65,
    flavorPositives: [
      "Buyers prioritize quality and safety over price, supporting healthier margins",
      "Gifting occasions (showers, birthdays) create recurring demand spikes",
    ],
    flavorRisks: [
      "Strict safety and compliance standards raise the bar to sell credibly",
      "New sellers face a trust gap parents are cautious to cross",
    ],
    candidates: [
      "Baby Nursery Night Light", "Silicone Baby Feeding Set",
      "Baby Monitor With Camera", "Toddler Travel Backpack",
      "Baby Swaddle Blanket Set", "Baby Bath Thermometer",
    ],
  },
  {
    category: "Fashion",
    keywords: [
      "sunglasses", "watch", "jewelry", "wallet", "belt", "handbag",
      "necklace", "crossbody",
    ],
    ranges: {
      demand: r(45, 75), competition: r(60, 90), margin: r(50, 75),
      shippingComplexity: r(15, 35), supplierAvailability: r(55, 85),
      bundlePotential: r(35, 60), brandOpportunity: r(55, 80),
      repeatPurchase: r(25, 50), trendStability: r(25, 50), returnRisk: r(35, 60),
    },
    weights: {
      demand: 0.14, competition: 0.12, margin: 0.18, shippingComplexity: 0.04,
      supplierAvailability: 0.06, bundlePotential: 0.09, brandOpportunity: 0.14,
      repeatPurchase: 0.07, trendStability: 0.10, returnRisk: 0.06,
    },
    priceFloor: 10, priceCeiling: 50,
    flavorPositives: [
      "Strong impulse-buy potential when styled well in listing photos",
      "Accessory categories support real brand and packaging differentiation",
    ],
    flavorRisks: [
      "Highly competitive with fast style and trend turnover",
      "Perceived quality is judged almost entirely on photos before purchase",
    ],
    candidates: [
      "Polarized Sunglasses", "Minimalist Wrist Watch",
      "Leather Wallet RFID Blocking", "Layered Necklace Set",
      "Woven Leather Belt", "Crossbody Handbag",
    ],
  },
  {
    category: "Automotive",
    keywords: [
      "car mount", "car seat cover", "car organizer", "dash cam",
      "car vacuum", "automotive", "car accessory", "trunk organizer",
    ],
    ranges: {
      demand: r(35, 60), competition: r(35, 60), margin: r(40, 65),
      shippingComplexity: r(35, 60), supplierAvailability: r(45, 70),
      bundlePotential: r(30, 55), brandOpportunity: r(35, 60),
      repeatPurchase: r(20, 40), trendStability: r(50, 75), returnRisk: r(30, 50),
    },
    weights: {
      demand: 0.12, competition: 0.08, margin: 0.16, shippingComplexity: 0.10,
      supplierAvailability: 0.08, bundlePotential: 0.08, brandOpportunity: 0.07,
      repeatPurchase: 0.07, trendStability: 0.14, returnRisk: 0.10,
    },
    priceFloor: 12, priceCeiling: 70,
    flavorPositives: [
      "Non-seasonal, utility-driven demand that holds up year-round",
      "Universal-fit designs reduce SKU complexity versus vehicle-specific parts",
    ],
    flavorRisks: [
      "Vehicle fitment mismatches are a common source of returns",
      "Buyers compare heavily on price against big-box auto retailers",
    ],
    candidates: [
      "Car Phone Mount Vent Clip", "Universal Car Seat Cover",
      "Car Trunk Organizer", "LED Interior Car Lights", "Car Dash Cam 1080p",
      "Car Vacuum Cleaner Portable",
    ],
  },
  {
    category: "Camping",
    keywords: [
      "camping", "outdoor", "hiking", "tent", "backpack", "hammock",
      "camping stove", "sleeping pad", "lantern",
    ],
    ranges: {
      demand: r(40, 65), competition: r(30, 55), margin: r(45, 70),
      shippingComplexity: r(55, 85), supplierAvailability: r(40, 65),
      bundlePotential: r(40, 65), brandOpportunity: r(45, 70),
      repeatPurchase: r(20, 40), trendStability: r(30, 55), returnRisk: r(20, 40),
    },
    weights: {
      demand: 0.14, competition: 0.08, margin: 0.16, shippingComplexity: 0.14,
      supplierAvailability: 0.08, bundlePotential: 0.08, brandOpportunity: 0.08,
      repeatPurchase: 0.06, trendStability: 0.12, returnRisk: 0.06,
    },
    priceFloor: 18, priceCeiling: 95,
    flavorPositives: [
      "Less price competition than mainstream, algorithm-saturated categories",
      "Enthusiast buyers research specs closely and value durability claims",
    ],
    flavorRisks: [
      "Strongly seasonal demand tied to weather and travel patterns",
      "Bulky items raise freight cost and warehouse footprint",
    ],
    candidates: [
      "Portable Camping Lantern", "Compact Camping Hammock",
      "Waterproof Hiking Backpack", "Portable Camping Stove",
      "Camping Sleeping Pad", "Collapsible Camping Chair",
    ],
  },
  {
    category: "Garden",
    keywords: [
      "garden tool", "raised bed", "grow light", "garden hose", "garden",
      "planter", "plant", "watering",
    ],
    ranges: {
      demand: r(30, 55), competition: r(25, 50), margin: r(40, 65),
      shippingComplexity: r(45, 75), supplierAvailability: r(40, 65),
      bundlePotential: r(30, 55), brandOpportunity: r(35, 60),
      repeatPurchase: r(25, 45), trendStability: r(40, 65), returnRisk: r(15, 35),
    },
    weights: {
      demand: 0.12, competition: 0.07, margin: 0.16, shippingComplexity: 0.12,
      supplierAvailability: 0.08, bundlePotential: 0.07, brandOpportunity: 0.07,
      repeatPurchase: 0.08, trendStability: 0.16, returnRisk: 0.07,
    },
    priceFloor: 10, priceCeiling: 60,
    flavorPositives: [
      "Loyal hobbyist audience with strong seasonal repeat intent each spring",
      "Low defect rates for simple, mechanical garden goods",
    ],
    flavorRisks: [
      "Sharp seasonal falloff outside of spring and summer",
      "Heavier or bulky items (soil, raised beds) raise shipping costs",
    ],
    candidates: [
      "Self-Watering Planter Pot", "Garden Tool Set 5-Piece",
      "Solar Garden Path Lights", "Raised Garden Bed Kit",
      "Retractable Garden Hose", "Plant Grow Light Bulb",
    ],
  },
  {
    category: "Tools",
    keywords: [
      "tool organizer", "screwdriver", "wrench", "work light", "toolbox",
      "drill", "tool",
    ],
    ranges: {
      demand: r(30, 55), competition: r(30, 55), margin: r(40, 65),
      shippingComplexity: r(40, 70), supplierAvailability: r(55, 85),
      bundlePotential: r(25, 50), brandOpportunity: r(30, 55),
      repeatPurchase: r(20, 40), trendStability: r(55, 80), returnRisk: r(15, 30),
    },
    weights: {
      demand: 0.12, competition: 0.08, margin: 0.16, shippingComplexity: 0.11,
      supplierAvailability: 0.09, bundlePotential: 0.06, brandOpportunity: 0.06,
      repeatPurchase: 0.08, trendStability: 0.17, returnRisk: 0.07,
    },
    priceFloor: 10, priceCeiling: 65,
    flavorPositives: [
      "Utility purchases with steady, trend-independent demand",
      "Low return rates once product quality is verified through reviews",
    ],
    flavorRisks: [
      "Buyers heavily favor established, trusted tool brands",
      "Price pressure from big-box hardware retailers",
    ],
    candidates: [
      "Magnetic Wristband Tool Holder", "Cordless Screwdriver Set",
      "Tool Storage Organizer Bag", "Precision Screwdriver Kit",
      "Adjustable Wrench Set", "LED Rechargeable Work Light",
    ],
  },
  {
    category: "Home",
    keywords: [
      "home decor", "night light", "throw pillow", "diffuser",
      "essential oil", "storage rack", "vacuum", "curtain", "humidifier",
      "air purifier", "heater",
    ],
    ranges: {
      demand: r(50, 75), competition: r(45, 70), margin: r(45, 70),
      shippingComplexity: r(35, 65), supplierAvailability: r(60, 90),
      bundlePotential: r(40, 65), brandOpportunity: r(40, 65),
      repeatPurchase: r(35, 60), trendStability: r(40, 65), returnRisk: r(25, 45),
    },
    weights: {
      demand: 0.15, competition: 0.09, margin: 0.18, shippingComplexity: 0.09,
      supplierAvailability: 0.07, bundlePotential: 0.10, brandOpportunity: 0.08,
      repeatPurchase: 0.10, trendStability: 0.08, returnRisk: 0.06,
    },
    priceFloor: 12, priceCeiling: 65,
    flavorPositives: [
      "Broad mainstream appeal with year-round browsing traffic",
      "Seasonal demand spikes (holidays, cold/flu season) create timing opportunities",
    ],
    flavorRisks: [
      "Electrical and safety compliance requirements for powered items",
      "Highly fragmented category with many near-identical competitors",
    ],
    candidates: [
      "Smart LED Night Light", "Decorative Throw Pillow Covers",
      "Aromatherapy Essential Oil Diffuser", "Wall-Mounted Storage Rack",
      "Cordless Handheld Vacuum", "Blackout Curtain Panels",
    ],
  },
  {
    category: "Electronics",
    keywords: [
      "earbud", "earphone", "headphone", "bluetooth speaker", "speaker",
      "charger", "usb-c", "usb c", "power bank", "charging cable", "cable",
      "phone case", "phone cover", "smartwatch", "laptop stand", "electronic",
    ],
    ranges: {
      demand: r(70, 95), competition: r(75, 98), margin: r(35, 65),
      shippingComplexity: r(20, 45), supplierAvailability: r(70, 95),
      bundlePotential: r(70, 95), brandOpportunity: r(30, 55),
      repeatPurchase: r(40, 65), trendStability: r(45, 70), returnRisk: r(60, 85),
    },
    weights: {
      demand: 0.18, competition: 0.14, margin: 0.14, shippingComplexity: 0.05,
      supplierAvailability: 0.05, bundlePotential: 0.16, brandOpportunity: 0.06,
      repeatPurchase: 0.08, trendStability: 0.05, returnRisk: 0.09,
    },
    priceFloor: 8, priceCeiling: 65,
    flavorPositives: [
      "High, consistent consumer demand across nearly every buyer segment",
      "Lightweight and cheap to ship at scale",
      "Cases, cables, and accessories create natural bundle attach-rate",
    ],
    flavorRisks: [
      "Dominated by established brands with massive ad budgets",
      "Frequent price undercutting from low-cost overseas sellers",
      "Defect and buyer's-remorse returns run higher than most categories",
    ],
    candidates: [
      "Wireless Earbuds", "USB-C Fast Charger 30W", "Bluetooth Speaker Mini",
      "Wireless Power Bank 10000mAh", "Smartwatch Fitness Band",
      "Noise Cancelling Headphones",
    ],
  },
];

// Wide, unopinionated bands used when no category keyword matches. The
// spread is intentionally broad since we have no category signal to narrow
// it — confidence scoring reflects that uncertainty separately.
export const FALLBACK_PROFILE: CategoryProfile = {
  category: "General Merchandise",
  keywords: [],
  ranges: {
    demand: r(30, 80), competition: r(35, 85), margin: r(30, 75),
    shippingComplexity: r(25, 75), supplierAvailability: r(35, 80),
    bundlePotential: r(25, 70), brandOpportunity: r(25, 70),
    repeatPurchase: r(20, 65), trendStability: r(30, 70), returnRisk: r(25, 65),
  },
  weights: {
    demand: 0.15, competition: 0.10, margin: 0.20, shippingComplexity: 0.08,
    supplierAvailability: 0.07, bundlePotential: 0.10, brandOpportunity: 0.08,
    repeatPurchase: 0.12, trendStability: 0.05, returnRisk: 0.05,
  },
  priceFloor: 8, priceCeiling: 70,
  flavorPositives: [
    "Lightweight and easy to ship in most cases",
    "Fits well with bundle or upsell offers",
    "Searchable keyword with clear buyer intent",
  ],
  flavorRisks: [
    "Limited category data available for this keyword",
    "Demand and competition estimates are broader without a matched category",
  ],
  candidates: [],
};

export function findCategoryProfile(query: string): CategoryProfile | null {
  const lower = query.toLowerCase();
  for (const profile of CATEGORY_PROFILES) {
    if (profile.keywords.some((keyword) => lower.includes(keyword))) {
      return profile;
    }
  }
  return null;
}

// Looks a profile up by its exact category name (e.g. the `category` field
// already stamped on an AnalysisResult) rather than re-matching keywords —
// used by the hybrid engine, which already knows which profile produced a
// given result and shouldn't risk a different match on re-derivation.
export function getCategoryProfileByName(name: string): CategoryProfile {
  return CATEGORY_PROFILES.find((profile) => profile.category === name) ?? FALLBACK_PROFILE;
}
