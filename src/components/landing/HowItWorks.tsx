const STEPS = [
  { title: "Search an idea", description: "Type any product idea, category, or keyword." },
  { title: "AI analyzes market signals", description: "Real listings are pulled from every connected marketplace and scored." },
  { title: "Compare opportunities", description: "See demand, competition, and margin side by side, ranked by opportunity score." },
  { title: "Validate before buying inventory", description: "Decide with real market data before you spend on stock." },
];

export default function HowItWorks() {
  return (
    <section className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
        How it works
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">
              {index + 1}
            </span>
            <h3 className="mt-3 text-sm font-bold text-dark dark:text-slate-100">{step.title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
