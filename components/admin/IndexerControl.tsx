"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type BatchResult = {
  indexedCount: number;
  skippedCount: number;
  lookbackBlocks: number;
  results: Array<{ tokenAddress: string; status: string; transferCount: number; walletCount: number; warnings: string[] }>;
  warnings: string[];
};

type WalletEvent = {
  id: string;
  tokenAddress: string;
  type: string;
  severity: "info" | "alpha" | "warning" | "danger";
  message: string;
  createdAt: string;
};

type EventPerformanceSummary = {
  totalEventsTracked: number;
  knownOutcomes: number;
  unknownOutcomes: number;
  goodRate: number | null;
  badRate: number | null;
  averageReturnAfter1h: number | null;
};

type MarketSampleResult = {
  requestedCount: number;
  sampledCount: number;
  snapshotCount: number;
  performanceRecordsRefreshed: number;
  warnings: string[];
};

export function IndexerControl() {
  const [running, setRunning] = useState(false);
  const [schedulerBusy, setSchedulerBusy] = useState(false);
  const [marketRunning, setMarketRunning] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [marketSample, setMarketSample] = useState<MarketSampleResult | null>(null);
  const [scheduler, setScheduler] = useState<any>(null);
  const [events, setEvents] = useState<WalletEvent[]>([]);
  const [performance, setPerformance] = useState<EventPerformanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadScheduler = async () => {
    const data = await fetch("/api/indexer/scheduler", { cache: "no-store" }).then((response) => response.json());
    setScheduler(data.scheduler);
  };

  const loadEvents = async () => {
    const data = await fetch("/api/intelligence/events?limit=12", { cache: "no-store" }).then((response) => response.json());
    setEvents(data.events ?? []);
  };

  const loadPerformance = async () => {
    const data = await fetch("/api/intelligence/events/performance", { cache: "no-store" }).then((response) => response.json());
    setPerformance(data.summary ?? null);
  };

  useEffect(() => {
    loadScheduler().catch(() => undefined);
    loadEvents().catch(() => undefined);
    loadPerformance().catch(() => undefined);
  }, []);

  const runBatch = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/indexer/holders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 3, lookbackBlocks: 1800 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Indexer run failed");
      setResult(data.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Indexer run failed");
    } finally {
      setRunning(false);
      loadScheduler().catch(() => undefined);
      loadEvents().catch(() => undefined);
      loadPerformance().catch(() => undefined);
    }
  };

  const updateScheduler = async (action: "start" | "stop" | "tick") => {
    setSchedulerBusy(true);
    setError(null);
    try {
      const response = action === "stop"
        ? await fetch("/api/indexer/scheduler", { method: "DELETE" })
        : await fetch("/api/indexer/scheduler", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action === "tick" ? { action: "tick" } : { action: "start", intervalMs: 120_000, batchLimit: 2, lookbackBlocks: 1800 })
        });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Scheduler update failed");
      setScheduler(data.scheduler);
      if (data.scheduler?.lastResult) setResult(data.scheduler.lastResult);
      if (data.scheduler?.lastMarketSample) setMarketSample(data.scheduler.lastMarketSample);
      loadEvents().catch(() => undefined);
      loadPerformance().catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Scheduler update failed");
    } finally {
      setSchedulerBusy(false);
    }
  };

  const runMarketSample = async () => {
    setMarketRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/indexer/market-sampler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 3 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Market sampler failed");
      setMarketSample(data.result);
      loadPerformance().catch(() => undefined);
      loadScheduler().catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Market sampler failed");
    } finally {
      setMarketRunning(false);
    }
  };

  return (
    <section className="mt-5 border border-terminal-border bg-terminal-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Holder Indexer Control</div>
          <p className="mt-1 text-sm text-terminal-muted">Build local wallet memory for recently observed tokens. Runs sequentially to protect RPC accuracy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={runBatch} disabled={running || schedulerBusy} className="inline-flex items-center gap-2 rounded-lg border border-terminal-cyan/50 bg-terminal-cyan/10 px-3 py-2 text-xs font-semibold text-terminal-cyan transition hover:bg-terminal-cyan/15 disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw size={14} className={running ? "animate-spin" : ""} />
            {running ? "Indexing..." : "Index next 3 tokens"}
          </button>
          <button onClick={runMarketSample} disabled={marketRunning || schedulerBusy} className="inline-flex items-center gap-2 rounded-lg border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 text-xs font-semibold text-terminal-green transition hover:bg-terminal-green/15 disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw size={14} className={marketRunning ? "animate-spin" : ""} />
            {marketRunning ? "Sampling..." : "Sample market snapshots"}
          </button>
          <button onClick={() => updateScheduler("tick")} disabled={schedulerBusy} className="rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-xs font-semibold text-terminal-muted transition hover:border-terminal-green/50 hover:text-terminal-green disabled:opacity-60">
            Run scheduler once
          </button>
          {scheduler?.enabled ? (
            <button onClick={() => updateScheduler("stop")} disabled={schedulerBusy} className="rounded-lg border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 text-xs font-semibold text-terminal-red transition hover:bg-terminal-red/15 disabled:opacity-60">
              Stop auto-indexer
            </button>
          ) : (
            <button onClick={() => updateScheduler("start")} disabled={schedulerBusy} className="rounded-lg border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 text-xs font-semibold text-terminal-green transition hover:bg-terminal-green/15 disabled:opacity-60">
              Start auto-indexer
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <MiniStat label="Scheduler" value={scheduler?.enabled ? "On" : "Off"} tone={scheduler?.enabled ? "green" : "amber"} />
        <MiniStat label="Running" value={scheduler?.running ? "Yes" : "No"} tone={scheduler?.running ? "amber" : "cyan"} />
        <MiniStat label="Run Count" value={scheduler?.runCount ?? 0} tone="cyan" />
        <MiniStat label="Batch Size" value={scheduler?.batchLimit ?? 2} tone="cyan" />
        <MiniStat label="Next Run" value={scheduler?.nextRunAt ? new Date(scheduler.nextRunAt).toLocaleTimeString() : "Manual"} tone="amber" />
      </div>

      {error && <div className="mt-3 border border-terminal-red/40 bg-terminal-red/10 p-3 text-xs text-terminal-red">{error}</div>}
      {marketSample && (
        <div className="mt-4 border border-terminal-border bg-terminal-bg/40 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Market Snapshot Sampler</div>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <MiniStat label="Requested" value={marketSample.requestedCount} tone="cyan" />
            <MiniStat label="Sampled" value={marketSample.sampledCount} tone="green" />
            <MiniStat label="Snapshots" value={marketSample.snapshotCount} tone="green" />
            <MiniStat label="Events Refreshed" value={marketSample.performanceRecordsRefreshed} tone="cyan" />
            <MiniStat label="Warnings" value={marketSample.warnings.length} tone={marketSample.warnings.length ? "amber" : "green"} />
          </div>
          {marketSample.warnings[0] && <div className="mt-3 text-xs text-terminal-amber">{marketSample.warnings[0]}</div>}
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniStat label="Indexed" value={result.indexedCount} tone="green" />
            <MiniStat label="Skipped" value={result.skippedCount} tone="amber" />
            <MiniStat label="Lookback Blocks" value={result.lookbackBlocks.toLocaleString()} tone="cyan" />
            <MiniStat label="Warnings" value={result.warnings.length} tone={result.warnings.length ? "amber" : "green"} />
          </div>
          <div className="overflow-auto border border-terminal-border bg-terminal-bg/50">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-2 text-left">Token</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Transfers</th>
                  <th className="px-3 py-2 text-right">Wallets</th>
                  <th className="px-3 py-2 text-left">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((row) => (
                  <tr key={row.tokenAddress} className="border-b border-terminal-border/60">
                    <td className="px-3 py-2 font-mono text-terminal-text">{row.tokenAddress.slice(0, 10)}...{row.tokenAddress.slice(-6)}</td>
                    <td className={row.status === "ok" ? "px-3 py-2 font-mono text-terminal-green" : row.status === "partial" ? "px-3 py-2 font-mono text-terminal-amber" : "px-3 py-2 font-mono text-terminal-red"}>{row.status}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.transferCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.walletCount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-terminal-muted">{row.warnings[0] ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="mt-4 border border-terminal-border bg-terminal-bg/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Wallet Event Performance</div>
            <div className="mt-1 text-xs text-terminal-muted">Outcome tracking updates as later market snapshots become available.</div>
          </div>
          <button
            onClick={async () => {
              const data = await fetch("/api/intelligence/events/performance", { method: "POST" }).then((response) => response.json());
              setPerformance(data.summary ?? null);
            }}
            className="rounded-lg border border-terminal-border px-3 py-2 text-xs font-semibold text-terminal-muted transition hover:border-terminal-cyan/50 hover:text-terminal-cyan"
          >
            Refresh outcomes
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <MiniStat label="Tracked" value={performance?.totalEventsTracked ?? 0} tone="cyan" />
          <MiniStat label="Known" value={performance?.knownOutcomes ?? 0} tone="green" />
          <MiniStat label="Unknown" value={performance?.unknownOutcomes ?? 0} tone="amber" />
          <MiniStat label="Good Rate" value={performance?.goodRate === null || performance?.goodRate === undefined ? "N/A" : `${(performance.goodRate * 100).toFixed(1)}%`} tone="green" />
          <MiniStat label="Bad Rate" value={performance?.badRate === null || performance?.badRate === undefined ? "N/A" : `${(performance.badRate * 100).toFixed(1)}%`} tone="amber" />
        </div>
      </div>
      <div className="mt-4 border border-terminal-border bg-terminal-bg/40">
        <div className="border-b border-terminal-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Wallet Intelligence Events</div>
        {events.length ? events.map((event) => (
          <div key={event.id} className="grid gap-2 border-b border-terminal-border/60 px-3 py-2 text-xs md:grid-cols-[92px_132px_1fr_160px]">
            <div className={event.severity === "alpha" ? "font-mono uppercase text-terminal-green" : event.severity === "warning" ? "font-mono uppercase text-terminal-amber" : event.severity === "danger" ? "font-mono uppercase text-terminal-red" : "font-mono uppercase text-terminal-cyan"}>{event.severity}</div>
            <div className="font-mono text-terminal-muted">{event.type.replaceAll("_", " ")}</div>
            <div className="text-terminal-text">{event.message}</div>
            <div className="font-mono text-terminal-muted">{event.tokenAddress.slice(0, 8)}... · {new Date(event.createdAt).toLocaleTimeString()}</div>
          </div>
        )) : (
          <div className="p-3 text-xs text-terminal-muted">No wallet intelligence events yet. Run the indexer to generate observed local signals.</div>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone: "green" | "amber" | "cyan" }) {
  const color = tone === "green" ? "text-terminal-green" : tone === "amber" ? "text-terminal-amber" : "text-terminal-cyan";
  return (
    <div className="border border-terminal-border bg-terminal-bg/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</div>
      <div className={`mt-2 font-mono text-lg ${color}`}>{value}</div>
    </div>
  );
}
