"use client";

import { ChartBox, MetricGrid, PanelTitle } from "@/components/analysis/MomentumPanel";
import type { HolderMetrics, HolderWalletIntelligence } from "@/lib/analysis/types";
import { formatCompact } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function HolderPanel({ metrics, tokenAddress }: { metrics: HolderMetrics; tokenAddress?: string }) {
  const [intelligence, setIntelligence] = useState<HolderWalletIntelligence | undefined>(metrics.walletIntelligence);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    setIntelligence(metrics.walletIntelligence);
  }, [metrics.walletIntelligence]);

  const runIndexer = async () => {
    if (!tokenAddress || indexing) return;
    setIndexing(true);
    try {
      const response = await fetch(`/api/indexer/holders/${encodeURIComponent(tokenAddress)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackBlocks: 7200 })
      });
      const data = await response.json();
      if (data.result?.summary) setIntelligence(data.result.summary);
    } finally {
      setIndexing(false);
    }
  };

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <PanelTitle title="Holder Analysis" />
        <button onClick={runIndexer} disabled={!tokenAddress || indexing} className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-xs font-semibold text-terminal-cyan transition hover:border-terminal-cyan/50 hover:bg-terminal-cyan/10 disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={14} className={indexing ? "animate-spin" : ""} />
          {indexing ? "Indexing..." : "Update wallet intelligence"}
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartBox>
          {metrics.growthSeries.length ? (
            <ResponsiveContainer width="100%" height={160}><AreaChart data={metrics.growthSeries}><XAxis dataKey="t" stroke="#8190a5" /><YAxis stroke="#8190a5" /><Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1d2633" }} /><Area dataKey="holders" stroke="#4cc9f0" fill="#4cc9f022" /></AreaChart></ResponsiveContainer>
          ) : (
            <div className="grid h-[160px] place-items-center px-4 text-center text-xs text-terminal-muted">Verified holder history is unavailable. Momentum Terminal will not draw a fake holder-growth chart.</div>
          )}
        </ChartBox>
        <ChartBox><ResponsiveContainer width="100%" height={160}><PieChart><Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1d2633" }} /><Pie data={metrics.ownershipDistribution} dataKey="ownership" nameKey="bucket" outerRadius={62} fill="#43d17a" /></PieChart></ResponsiveContainer></ChartBox>
      </div>
      <MetricGrid items={[
        ["Holders", metrics.holderCount !== null ? formatCompact(metrics.holderCount) : "Unknown"],
        ["Sample", String(metrics.sampledHolderCount ?? metrics.topHolders?.length ?? "N/A")],
        ["Velocity", `${metrics.holderVelocity.toFixed(0)}`],
        ["Top 10", `${metrics.top10Ownership.toFixed(1)}%`],
        ["Top 25", `${metrics.top25Ownership.toFixed(1)}%`],
        ["Burn", `${(metrics.burnOwnership ?? 0).toFixed(1)}%`],
        ["Health", `${metrics.holderHealthScore.toFixed(0)}`]
      ]} />
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">Source</div>
          <div className="mt-1 font-mono text-terminal-text">{metrics.source ?? "modeled"}</div>
          <div className="mt-1 text-terminal-muted">Confidence: {metrics.confidence ?? "low"}</div>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">Concentration Risk</div>
          <div className={metrics.concentrationRiskScore > 70 ? "mt-1 font-mono text-terminal-red" : metrics.concentrationRiskScore > 45 ? "mt-1 font-mono text-terminal-amber" : "mt-1 font-mono text-terminal-green"}>{metrics.concentrationRiskScore.toFixed(0)} / 100</div>
          <div className="mt-1 text-terminal-muted">Top 50: {metrics.top50Ownership?.toFixed(1) ?? "N/A"}%</div>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">Custody Buckets</div>
          <div className="mt-1 font-mono text-terminal-text">LP {(metrics.lpOwnership ?? 0).toFixed(1)}% · Contracts {(metrics.contractOwnership ?? 0).toFixed(1)}%</div>
          <div className="mt-1 text-terminal-muted">Retail {(metrics.retailOwnership ?? 0).toFixed(1)}%</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {(metrics.actionableSignals ?? []).map((signal, index) => (
          <div key={`${signal}-${index}`} className="border border-terminal-amber/30 bg-terminal-amber/10 p-2 text-xs text-terminal-amber">{signal}</div>
        ))}
        {(metrics.warnings ?? []).map((warning, index) => (
          <div key={`${warning}-${index}`} className="border border-terminal-border bg-[#0a0f16] p-2 text-xs text-terminal-muted">{warning}</div>
        ))}
      </div>
      <div className="mt-3 border border-terminal-border bg-[#0a0f16]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border px-3 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">Local Wallet Intelligence</div>
            <div className="mt-1 text-xs text-terminal-muted">Built from observed Transfer logs. This is a local memory layer, not a complete historical guarantee.</div>
          </div>
          <div className="font-mono text-xs text-terminal-muted">{intelligence?.lastRun ? `Last run ${new Date(intelligence.lastRun.finishedAt).toLocaleTimeString()}` : "Not indexed yet"}</div>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-5">
          <MiniStat label="Transfers" value={formatCompact(intelligence?.indexedTransferCount ?? 0)} />
          <MiniStat label="Wallets" value={formatCompact(intelligence?.indexedWalletCount ?? 0)} />
          <MiniStat label="Recent active" value={formatCompact(intelligence?.activeWalletsRecent ?? 0)} />
          <MiniStat label="Net accum." value={formatCompact(intelligence?.netAccumulatorWallets ?? 0)} tone="green" />
          <MiniStat label="Net distrib." value={formatCompact(intelligence?.netDistributorWallets ?? 0)} tone="red" />
        </div>
        {(intelligence?.warnings ?? []).map((warning, index) => (
          <div key={`${warning}-${index}`} className="border-t border-terminal-border/60 px-3 py-2 text-xs text-terminal-amber">{warning}</div>
        ))}
        <div className="grid grid-cols-[1fr_110px_92px_92px] border-t border-terminal-border px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-terminal-muted">
          <div>Wallet</div>
          <div>Direction</div>
          <div className="text-right">In</div>
          <div className="text-right">Out</div>
        </div>
        {(intelligence?.largestObservedWallets ?? []).length ? intelligence!.largestObservedWallets.map((wallet) => (
          <div key={wallet.address} className="grid grid-cols-[1fr_110px_92px_92px] items-center border-t border-terminal-border/60 px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="truncate font-mono text-terminal-text">{wallet.address}</div>
              <div className="text-terminal-muted">Blocks {wallet.firstSeenBlock.toLocaleString()} - {wallet.lastSeenBlock.toLocaleString()}</div>
            </div>
            <div className={wallet.direction === "accumulating" ? "font-mono text-terminal-green" : wallet.direction === "distributing" ? "font-mono text-terminal-red" : "font-mono text-terminal-muted"}>{wallet.direction}</div>
            <div className="text-right font-mono text-terminal-text">{wallet.inCount}</div>
            <div className="text-right font-mono text-terminal-text">{wallet.outCount}</div>
          </div>
        )) : <div className="border-t border-terminal-border/60 p-3 text-xs text-terminal-muted">Run the indexer to build local wallet observations for this token.</div>}
      </div>
      <div className="mt-3 border border-terminal-border bg-[#0a0f16]">
        <div className="grid grid-cols-[44px_1fr_92px_92px] border-b border-terminal-border px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-terminal-muted">
          <div>#</div>
          <div>Holder</div>
          <div>Type</div>
          <div className="text-right">Owns</div>
        </div>
        {(metrics.topHolders ?? []).length ? metrics.topHolders!.map((holder, index) => (
          <div key={`${holder.address}-${index}`} className="grid grid-cols-[44px_1fr_92px_92px] items-center border-b border-terminal-border/60 px-3 py-2 text-xs">
            <div className="font-mono text-terminal-muted">{index + 1}</div>
            <div className="min-w-0">
              <div className="truncate font-mono text-terminal-text">{holder.label || holder.address}</div>
              <div className="truncate text-terminal-muted">{holder.address}</div>
            </div>
            <div className={holder.category === "burn" ? "font-mono text-terminal-amber" : holder.category === "whale" ? "font-mono text-terminal-red" : "font-mono text-terminal-muted"}>{holder.category ?? "unknown"}</div>
            <div className="text-right font-mono text-terminal-text">{holder.ownershipPct?.toFixed(2) ?? "N/A"}%</div>
          </div>
        )) : <div className="p-4 text-xs text-terminal-muted">No top-holder rows available from the configured indexers yet.</div>}
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "red" }) {
  const color = tone === "green" ? "text-terminal-green" : tone === "red" ? "text-terminal-red" : "text-terminal-text";
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-bg/50 p-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
