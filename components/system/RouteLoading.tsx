import { Activity } from "lucide-react";

export function RouteLoading({
  title = "Loading Momentum Terminal",
  subtitle = "Pulling fresh data and preparing the intelligence workspace.",
  variant = "terminal"
}: {
  title?: string;
  subtitle?: string;
  variant?: "terminal" | "bankr" | "accuracy" | "plain";
}) {
  const columns = variant === "accuracy" ? 4 : variant === "bankr" ? 5 : 3;
  const gridClass = variant === "bankr" ? "md:grid-cols-5" : variant === "accuracy" ? "md:grid-cols-4" : "md:grid-cols-3";

  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-lg border border-terminal-border bg-terminal-panel p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-terminal-green/50 bg-terminal-green/10 text-terminal-green shadow-glow">
                <Activity className="animate-pulse" size={21} />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terminal-muted">Preparing View</div>
                <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
                <p className="mt-1 text-sm text-terminal-muted">{subtitle}</p>
              </div>
            </div>
            <div className="rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/10 px-3 py-2 font-mono text-xs text-terminal-cyan">
              live data loading
            </div>
          </div>
        </div>

        <div className={`mt-4 grid gap-3 ${gridClass}`}>
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
            <div className="mb-4 h-4 w-48 animate-pulse rounded bg-terminal-border/70" />
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[80px_1fr_120px] gap-3">
                  <div className="h-3 animate-pulse rounded bg-terminal-border/70" />
                  <div className="h-3 animate-pulse rounded bg-terminal-border/60" />
                  <div className="h-3 animate-pulse rounded bg-terminal-border/70" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
            <div className="mb-4 h-4 w-36 animate-pulse rounded bg-terminal-border/70" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded border border-terminal-border bg-terminal-bg/60" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
      <div className="h-3 w-20 animate-pulse rounded bg-terminal-border/70" />
      <div className="mt-4 h-7 w-28 animate-pulse rounded bg-terminal-border/60" />
      <div className="mt-3 h-2 w-full animate-pulse rounded bg-terminal-border/50" />
    </div>
  );
}
