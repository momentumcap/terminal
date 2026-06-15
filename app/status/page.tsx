import { LiveStatusDashboard } from "@/components/status/LiveStatusDashboard";
import { StatusActions } from "@/components/status/StatusActions";
import { getFreshnessServiceStatus } from "@/lib/indexer/freshnessService";
import Link from "next/link";

export default function StatusPage() {
  const freshnessService = getFreshnessServiceStatus();

  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terminal-cyan">Live Status</div>
            <h1 className="mt-2 font-mono text-3xl font-semibold">Momentum Terminal Status</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
              The page shell loads immediately. Provider checks and trust health refresh in the background so slow APIs do not block navigation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">Terminal</Link>
            <Link href="/feedback" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-amber hover:text-terminal-amber">Report Issue</Link>
            <Link href="/limitations" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-cyan hover:text-terminal-cyan">Limitations</Link>
          </div>
        </div>

        <StatusActions />

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat label="Auto Freshness" value={freshnessService.enabled ? "Running" : "Stopped"} tone={freshnessService.enabled ? "green" : "amber"} />
          <Stat label="Freshness Runs" value={freshnessService.runCount} tone="cyan" />
          <Stat label="Last Warmup" value={freshnessService.lastRunAt ?? "Never"} tone={freshnessService.lastRunAt ? "green" : "amber"} />
          <Stat label="Next Warmup" value={freshnessService.nextRunAt ?? "Manual"} tone="cyan" />
        </section>

        <div className="mt-5">
          <LiveStatusDashboard />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "green" | "amber" | "red" | "cyan" }) {
  const colors = {
    green: "text-terminal-green",
    amber: "text-terminal-amber",
    red: "text-terminal-red",
    cyan: "text-terminal-cyan"
  };
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</div>
      <div className={`mt-2 font-mono text-lg ${colors[tone]}`}>{value}</div>
    </div>
  );
}
