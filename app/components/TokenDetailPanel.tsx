"use client";

import { MetricCard } from "@/app/components/MetricCard";
import { ScoreBadge } from "@/app/components/ScoreBadge";
import { SparklineChart } from "@/app/components/SparklineChart";
import { DataConfidenceBadge } from "@/components/trust/DataConfidenceBadge";
import { freshnessLabel } from "@/lib/freshness";
import { STALE_THRESHOLDS_MS, isTrustStale } from "@/lib/trust/staleness";
import type { TrustedMetric } from "@/lib/trust/types";
import type { TokenWithScores } from "@/lib/types";
import { formatAge, formatCompact, formatPercent, formatUsd } from "@/lib/utils";
import { BarChart3, ExternalLink, MousePointerClick, Search, ShieldAlert } from "lucide-react";

export function TokenDetailPanel({ token, onAnalyze }: { token: TokenWithScores | null; onAnalyze?: (address: string) => void }) {
  if (!token) {
    return (
      <aside className="flex min-h-[420px] items-center justify-center rounded-lg border border-terminal-border bg-terminal-panel/90 p-6 text-center text-sm text-terminal-muted shadow-panel xl:h-full xl:min-h-0">
        <div className="max-w-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/10 text-terminal-cyan">
            <MousePointerClick size={22} />
          </div>
          <div className="mt-4 text-base font-semibold text-terminal-text">Select a token to inspect</div>
          <div className="mt-2 leading-relaxed">Click any token row or card to open price, liquidity, flow, risk notes, source confidence, and links.</div>
          <div className="mt-4 grid gap-2 text-left text-xs">
            <div className="rounded-md border border-terminal-border bg-terminal-bg/50 p-3">
              <div className="flex items-center gap-2 font-mono text-terminal-green"><Search size={13} /> Search exact</div>
              <div className="mt-1 text-terminal-muted">Paste a contract address in the top search bar for one token.</div>
            </div>
            <div className="rounded-md border border-terminal-border bg-terminal-bg/50 p-3">
              <div className="font-mono text-terminal-cyan">Need deeper proof?</div>
              <div className="mt-1 text-terminal-muted">Open Analysis for onchain holder, wallet, contract, and source-quality checks.</div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const riskAccent = token.riskLevel === "low" ? "green" : token.riskLevel === "medium" ? "amber" : "red";
  const sourceList = token.marketDataSources?.length ? token.marketDataSources.join(" + ") : token.primaryMarketSource ?? "Unknown";
  const isMock = token.primaryMarketSource === "Mock" || Boolean(token.marketDataSources?.includes("Mock"));
  const isMarketStale = isTrustStale(token.updatedAt, token.primaryMarketSource === "GeckoTerminal" ? STALE_THRESHOLDS_MS.geckoterminal : STALE_THRESHOLDS_MS.market);
  const marketCapFallback = !token.marketCap && Boolean(token.fdv);
  const displayConfidence = isMarketStale || isMock ? "low" : marketCapFallback ? "medium" : "high";
  const checklist = [
    { label: "Liquidity", value: token.liquidityUsd && token.liquidityUsd >= 100000 ? "Deep enough" : token.liquidityUsd && token.liquidityUsd >= 25000 ? "Moderate" : "Thin", tone: token.liquidityUsd && token.liquidityUsd >= 100000 ? "green" : token.liquidityUsd && token.liquidityUsd >= 25000 ? "amber" : "red" },
    { label: "Vol/Liq", value: token.volumeToLiquidityRatio && token.volumeToLiquidityRatio <= 5 ? "Normal" : token.volumeToLiquidityRatio ? "Hot" : "Unknown", tone: token.volumeToLiquidityRatio && token.volumeToLiquidityRatio <= 5 ? "green" : token.volumeToLiquidityRatio ? "amber" : "red" },
    { label: "Flow", value: token.buySellImbalance !== null && token.buySellImbalance >= 0.15 ? "Buy pressure" : token.buySellImbalance !== null && token.buySellImbalance <= -0.15 ? "Sell pressure" : "Mixed", tone: token.buySellImbalance !== null && token.buySellImbalance >= 0.15 ? "green" : token.buySellImbalance !== null && token.buySellImbalance <= -0.15 ? "red" : "amber" },
    { label: "Freshness", value: isMarketStale ? "Stale" : "Fresh", tone: isMarketStale ? "red" : "green" }
  ] as const;
  const metric = (label: string, value: number | null | undefined, estimated = false): TrustedMetric<unknown> => {
    return {
      value: value ?? null,
      label,
      source: sourceList,
      sourcesTried: token.marketDataSources ?? [token.primaryMarketSource ?? "Unknown"],
      confidence: isMarketStale ? "low" : isMock || estimated ? "medium" : "high",
      isEstimated: estimated || isMock,
      isStale: isMarketStale,
      lastUpdated: token.updatedAt,
      missingFields: value === null || value === undefined ? [label] : [],
      warnings: [
        ...(isMarketStale ? [`${label} is stale.`] : []),
        ...(estimated ? [`${label} is a fallback/estimated field.`] : []),
        ...(isMock ? ["Mock/demo data is not tradeable intelligence."] : [])
      ]
    };
  };

  return (
    <aside className="min-h-[560px] overflow-auto rounded-lg border border-terminal-border bg-terminal-panel/95 shadow-panel xl:h-full xl:min-h-0">
      <div className="border-b border-terminal-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-2xl font-semibold text-terminal-text">{token.symbol}</div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${riskAccent === "green" ? "border-terminal-green/30 bg-terminal-green/10 text-terminal-green" : riskAccent === "amber" ? "border-terminal-amber/30 bg-terminal-amber/10 text-terminal-amber" : "border-terminal-red/30 bg-terminal-red/10 text-terminal-red"}`}>{token.riskLevel} risk</span>
            </div>
            <div className="mt-1 text-sm text-terminal-muted">{token.name}</div>
          </div>
          <ScoreBadge score={token.scores.opportunityScore} label="OPP" />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-xl text-terminal-green">{formatUsd(token.priceUsd, 6)}</div>
            <div className="text-xs text-terminal-muted">Base chainId 8453 · {sourceList} · updated {freshnessLabel(token.updatedAt)}</div>
          </div>
          <SparklineChart data={token.sparkline} positive={(token.priceChange1h ?? 0) >= 0} />
        </div>
        <div className={`mt-4 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${isMock ? "border-terminal-red/40 bg-terminal-red/10 text-terminal-red" : "border-terminal-cyan/30 bg-terminal-cyan/5 text-terminal-cyan"}`}>
          {isMock ? "Mock/demo market data. Do not use for trading." : `Live market data from ${sourceList}. Pair-scoped figures can differ between providers by pool coverage, cache timing, and aggregation windows.`}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-terminal-muted">
          <DataConfidenceBadge confidence={displayConfidence} />
          {isMarketStale && <span className="text-terminal-amber">Market feed is stale. Refresh before acting.</span>}
          {marketCapFallback && <span className="text-terminal-amber">Market cap unavailable; FDV is being shown as fallback.</span>}
          {!isMarketStale && !marketCapFallback && !isMock && <span>Primary market metrics are fresh enough for display confidence.</span>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => onAnalyze?.(token.tokenAddress)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-terminal-cyan/45 bg-terminal-cyan/10 px-3 py-2 font-semibold text-terminal-cyan transition hover:bg-terminal-cyan/15">
            <BarChart3 size={14} />
            Analyze Token
          </button>
          {token.url && (
            <a className="inline-flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 font-semibold text-terminal-green transition hover:border-terminal-green/50 hover:bg-terminal-green/10" href={token.url} target="_blank" rel="noreferrer">
              Open Pair <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <MetricCard label="FDV" value={formatUsd(token.fdv, 1)} metric={metric("FDV", token.fdv)} />
        <MetricCard label="Mkt Cap" value={formatUsd(token.marketCap, 1)} metric={metric("Market cap", token.marketCap, token.marketCap === null && token.fdv !== null)} />
        <MetricCard label="Liquidity" value={formatUsd(token.liquidityUsd, 1)} accent="cyan" metric={metric("Liquidity", token.liquidityUsd)} />
        <MetricCard label="24h Volume" value={formatUsd(token.volume24h, 1)} accent="green" metric={metric("24h volume", token.volume24h)} />
        <MetricCard label="Vol/Liq" value={token.volumeToLiquidityRatio?.toFixed(2) ?? "N/A"} accent="amber" metric={metric("Volume/liquidity ratio", token.volumeToLiquidityRatio, true)} />
        <MetricCard label="Liq/Vol" value={token.liquidityToVolumeRatio?.toFixed(2) ?? "N/A"} metric={metric("Liquidity/volume ratio", token.liquidityToVolumeRatio, true)} />
        <MetricCard label="5m Buys" value={formatCompact(token.txns5mBuys)} accent="green" metric={metric("5m buys", token.txns5mBuys)} />
        <MetricCard label="5m Sells" value={formatCompact(token.txns5mSells)} accent="red" metric={metric("5m sells", token.txns5mSells)} />
      </div>

      <div className="space-y-3 border-t border-terminal-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-terminal-muted">Decision Checklist</div>
        <div className="grid grid-cols-2 gap-2">
          {checklist.map((item) => (
            <div key={item.label} className="rounded-lg border border-terminal-border bg-terminal-bg/55 p-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{item.label}</div>
              <div className={item.tone === "green" ? "mt-2 font-mono text-sm text-terminal-green" : item.tone === "amber" ? "mt-2 font-mono text-sm text-terminal-amber" : "mt-2 font-mono text-sm text-terminal-red"}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-terminal-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-terminal-muted">Scores</div>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Momentum" value={String(token.scores.momentumScore)} accent="green" />
          <MetricCard label="Liquidity" value={String(token.scores.liquidityHealthScore)} accent="cyan" />
          <MetricCard label="Flow" value={String(token.scores.flowScore)} accent="green" />
          <MetricCard label="Risk" value={String(token.scores.riskScore)} accent={riskAccent} />
        </div>
        <div className="text-[11px] leading-relaxed text-terminal-muted">
          Scores are deterministic calculations from the visible market feed. Use the Analysis Engine for onchain holder, contract, and wallet verification.
        </div>
      </div>

      <div className="space-y-3 border-t border-terminal-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-terminal-muted">Market Windows</div>
        <div className="grid grid-cols-4 gap-2 font-mono text-xs">
          {[
            ["5m", token.volume5m, token.priceChange5m],
            ["1h", token.volume1h, token.priceChange1h],
            ["6h", token.volume6h, token.priceChange6h],
            ["24h", token.volume24h, token.priceChange24h]
          ].map(([label, volume, change]) => (
            <div key={String(label)} className="rounded-lg border border-terminal-border bg-terminal-bg/55 p-2">
              <div className="text-terminal-muted">{label}</div>
              <div>{formatUsd(volume as number | null, 1)}</div>
              <div className={(Number(change) ?? 0) >= 0 ? "text-terminal-green" : "text-terminal-red"}>{formatPercent(change as number | null)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-terminal-border p-4 text-xs">
        <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.16em] text-terminal-muted">
          <ShieldAlert size={14} />
          Risk Flags
        </div>
        <div className="space-y-2 text-terminal-muted">
          <div>Pool age: <span className="font-mono text-terminal-text">{formatAge(token.ageHours)}</span></div>
          <div>DEX: <span className="font-mono text-terminal-text">{token.dexId}</span></div>
          <div>Pair: <span className="font-mono text-terminal-text">{token.pairAddress.slice(0, 10)}...</span></div>
          <div>Data freshness: <span className="font-mono text-terminal-green">{freshnessLabel(token.updatedAt)}</span></div>
          <div>Data source: <span className="font-mono text-terminal-cyan">{sourceList}</span></div>
          <div>Holder concentration: <span className="font-mono text-terminal-amber">open Analysis Engine for onchain/indexer estimate</span></div>
        </div>
      </div>
    </aside>
  );
}
