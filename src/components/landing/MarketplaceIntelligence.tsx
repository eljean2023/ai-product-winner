interface Tile {
  name: string;
  icon: string;
  status: string;
  statusClass: string;
}

const TILES: Tile[] = [
  { name: "SerpAPI", icon: "🔎", status: "Primary Source", statusClass: "text-primary-dark dark:text-secondary" },
  { name: "Amazon", icon: "📦", status: "Live · via SerpAPI", statusClass: "text-primary-dark dark:text-secondary" },
  { name: "eBay", icon: "🏷️", status: "Live · via SerpAPI", statusClass: "text-primary-dark dark:text-secondary" },
  { name: "Mercado Libre", icon: "🛒", status: "Optional · LatAm", statusClass: "text-slate-500 dark:text-slate-400" },
  { name: "Keepa", icon: "📈", status: "Planned · V2", statusClass: "text-slate-400 dark:text-slate-600" },
];

export default function MarketplaceIntelligence() {
  return (
    <section className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
        Marketplace Intelligence
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
        Designed to combine multiple marketplace signals.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {TILES.map((tile) => (
          <div
            key={tile.name}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span>{tile.icon}</span>
            <div>
              <div className="font-semibold text-dark dark:text-slate-100">{tile.name}</div>
              <div className={`text-xs ${tile.statusClass}`}>{tile.status}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
