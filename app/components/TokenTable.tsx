"use client";

import { ScoreBadge } from "@/app/components/ScoreBadge";
import { SparklineChart } from "@/app/components/SparklineChart";
import { freshnessLabel, isStale, POLL_INTERVALS } from "@/lib/freshness";
import type { TokenWithScores } from "@/lib/types";
import { cn, formatAge, formatPercent, formatUsd } from "@/lib/utils";
import { AlertTriangle, ArrowDown, ArrowUp, ShieldCheck } from "lucide-react";

export function TokenTable({
  tokens,
  selectedAddress,
  onSelect,
  loading = false,
  emptyReason = "filters"
}: {
  tokens: TokenWithScores[];
  selectedAddress: string | null;
  onSelect: (token: TokenWithScores) => void;
  loading?: boolean;
  emptyReason?: "loading" | "filters" | "sync";
}) {
  return (
    <div className="h-full overflow-auto rounded-lg">
      {loading && tokens.length === 0 && <TokenTableSkeleton />}
      <div className="grid gap-3 p-3 lg:hidden">
        {!loading && tokens.map((token, index) => {
          const selected = selectedAddress?.toLowerCase() === token.tokenAddress.toLowerCase();
          const change = token.priceChange1h ?? 0;
          const imbalance = token.buySellImbalance ?? 0;
          const stale = isStale(token.updatedAt, POLL_INTERVALS.terminalMs * 4);
          const source = token.primaryMarketSource ?? "Unknown";
          const marketCapFallback = !token.marketCap && Boolean(token.fdv);
          const confidence = stale || source === "Mock" ? "low" : marketCapFallback ? "medium" : "high";
          return (
            <button
              key={`${token.tokenAddress}-${token.pairAddress || token.dexId}-${index}-card`}
              onClick={() => onSelect(token)}
              className={cn("rounded-lg border bg-terminal-panel/90 p-3 text-left shadow-panel transition hover:border-terminal-cyan/50 hover:bg-terminal-cyan/5", selected ? "border-terminal-green/50 bg-terminal-green/10" : "border-terminal-border")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-terminal-border bg-terminal-bg/60 px-2 py-1 font-mono text-[10px] text-terminal-muted">#{index + 1}</span>
                    <span className="truncate font-mono text-base font-semibold text-terminal-text">{token.symbol}</span>
                  </div>
                  <div className="mt-1 max-w-[220px] truncate text-xs text-terminal-muted">{token.name}</div>
                </div>
                <ScoreBadge score={token.scores.opportunityScore} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MobileMetric label={token.marketCap && token.marketCap > 0 ? "Market Cap" : token.fdv ? "FDV" : "Value"} value={formatUsd(token.marketCap ?? token.fdv, 1)} tone="cyan" />
                <MobileMetric label="Price" value={formatUsd(token.priceUsd, 5)} />
                <MobileMetric label="Liquidity" value={formatUsd(token.liquidityUsd, 1)} tone="cyan" />
                <MobileMetric label="24h Volume" value={formatUsd(token.volume24h, 1)} tone="green" />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className={cn("rounded-md border border-terminal-border bg-terminal-bg/45 p-2 font-mono", change >= 0 ? "text-terminal-green" : "text-terminal-red")}>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-terminal-muted">1h</div>
                  <div className="mt-1 flex items-center gap-1">{change >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{formatPercent(change)}</div>
                </div>
                <div className={cn("rounded-md border border-terminal-border bg-terminal-bg/45 p-2 font-mono", imbalance >= 0 ? "text-terminal-green" : "text-terminal-red")}>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-terminal-muted">Flow</div>
                  <div className="mt-1">{(imbalance * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-md border border-terminal-border bg-terminal-bg/45 p-2 font-mono text-terminal-muted">
                  <div className="text-[9px] uppercase tracking-[0.12em]">Age</div>
                  <div className="mt-1">{formatAge(token.ageHours)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-terminal-border/70 pt-3">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]", confidence === "high" ? "border-terminal-green/30 text-terminal-green" : confidence === "medium" ? "border-terminal-amber/30 text-terminal-amber" : "border-terminal-red/30 text-terminal-red")}>
                    {confidence === "high" ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                    {confidence}
                  </span>
                  <span className={cn("font-mono text-[10px]", source === "Mock" ? "text-terminal-red" : "text-terminal-cyan")}>{source}</span>
                </div>
                <div className={cn("font-mono text-[10px]", stale ? "text-terminal-amber" : "text-terminal-muted")}>{freshnessLabel(token.updatedAt)}</div>
              </div>
            </button>
          );
        })}
      </div>

      <table className={cn("hidden w-full min-w-[1120px] border-collapse text-sm lg:table", loading && tokens.length === 0 && "lg:hidden")}>
        <thead className="sticky top-0 z-10 bg-[#111a26]/95 text-[10px] uppercase tracking-[0.14em] text-terminal-muted backdrop-blur">
          <tr className="border-b border-terminal-border">
            <th className="px-4 py-3 text-left">Rank</th>
            <th className="px-4 py-3 text-left">Token</th>
            <th className="px-4 py-3 text-right">MCap/FDV</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Liq</th>
            <th className="px-4 py-3 text-right">Vol 24h</th>
            <th className="px-4 py-3 text-right">1h</th>
            <th className="px-4 py-3 text-right">Flow</th>
            <th className="px-4 py-3 text-center">Spark</th>
            <th className="px-4 py-3 text-center">Opp</th>
            <th className="px-4 py-3 text-right">Age</th>
            <th className="px-4 py-3 text-right">Data</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, index) => {
            const selected = selectedAddress?.toLowerCase() === token.tokenAddress.toLowerCase();
            const change = token.priceChange1h ?? 0;
            const imbalance = token.buySellImbalance ?? 0;
            const stale = isStale(token.updatedAt, POLL_INTERVALS.terminalMs * 4);
            const source = token.primaryMarketSource ?? "Unknown";
            const marketCapFallback = !token.marketCap && Boolean(token.fdv);
            const confidence = stale || source === "Mock" ? "low" : marketCapFallback ? "medium" : "high";
            return (
              <tr key={`${token.tokenAddress}-${token.pairAddress || token.dexId}-${index}`} onClick={() => onSelect(token)} className={cn("group cursor-pointer border-b border-terminal-border/55 transition hover:bg-terminal-cyan/5", selected && "bg-terminal-green/10")}>
                <td className="px-4 py-3 font-mono text-terminal-muted">
                  <span className={cn("inline-flex h-7 min-w-9 items-center justify-center rounded-full border border-terminal-border bg-terminal-bg/50 text-[11px]", index < 3 && "border-terminal-green/35 text-terminal-green")}>#{index + 1}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono font-semibold text-terminal-text transition group-hover:text-terminal-cyan">{token.symbol}</div>
                  <div className="max-w-44 truncate text-xs text-terminal-muted">{token.name}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-terminal-cyan">
                  <div>{formatUsd(token.marketCap ?? token.fdv, 1)}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{token.marketCap && token.marketCap > 0 ? "MCap" : token.fdv ? "FDV" : "N/A"}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatUsd(token.priceUsd, 5)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatUsd(token.liquidityUsd, 1)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatUsd(token.volume24h, 1)}</td>
                <td className={cn("px-4 py-3 text-right font-mono", change >= 0 ? "text-terminal-green" : "text-terminal-red")}>
                  <span className="inline-flex items-center justify-end gap-1">
                    {change >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    {formatPercent(change)}
                  </span>
                </td>
                <td className={cn("px-4 py-3 text-right font-mono", imbalance >= 0 ? "text-terminal-green" : "text-terminal-red")}>{(imbalance * 100).toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <SparklineChart data={token.sparkline} positive={(token.priceChange1h ?? 0) >= 0} />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={token.scores.opportunityScore} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-terminal-muted">{formatAge(token.ageHours)}</td>
                <td className={cn("px-4 py-3 text-right font-mono text-xs", stale ? "text-terminal-amber" : "text-terminal-muted")}>
                  <div className={source === "Mock" ? "text-terminal-red" : "text-terminal-cyan"}>{source}</div>
                  <div>{freshnessLabel(token.updatedAt)}</div>
                  <div className={cn("mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]", confidence === "high" ? "border-terminal-green/30 text-terminal-green" : confidence === "medium" ? "border-terminal-amber/30 text-terminal-amber" : "border-terminal-red/30 text-terminal-red")} title={marketCapFallback ? "Market cap unavailable; FDV is displayed instead." : stale ? "Market data is stale." : "Market data is fresh enough for high display confidence."}>
                    {confidence === "high" ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                    {confidence}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!loading && tokens.length === 0 && (
        <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
          <div className="max-w-lg rounded-lg border border-dashed border-terminal-border bg-terminal-bg/45 p-6 text-sm text-terminal-muted">
            <div className="text-base font-semibold text-terminal-text">{emptyReason === "sync" ? "No live token data returned" : "No tokens match these filters"}</div>
            <div className="mt-2 leading-relaxed">
              {emptyReason === "sync"
                ? "The terminal did not receive a usable live response. Check provider health, then refresh. Mock market data stays hidden so users are not shown fake figures."
                : "Try lowering minimum liquidity or volume, switch between Trending and New Pools, or search an exact contract address."}
            </div>
            <div className="mt-4 grid gap-2 text-left text-xs sm:grid-cols-3">
              <EmptyHint label="Lower filters" text="Start with $0 liquidity and volume if you are hunting very new pools." />
              <EmptyHint label="Search exact" text="Paste the full 0x contract address for one token." />
              <EmptyHint label="Verify source" text="Open Trust Status if providers are stale or degraded." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenTableSkeleton() {
  return (
    <>
      <div className="grid gap-3 p-3 lg:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-terminal-border bg-terminal-panel/80 p-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-28 animate-pulse rounded bg-terminal-border/60" />
              <div className="h-7 w-14 animate-pulse rounded-full bg-terminal-border/60" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="h-14 animate-pulse rounded bg-terminal-border/40" />
              <div className="h-14 animate-pulse rounded bg-terminal-border/40" />
              <div className="h-14 animate-pulse rounded bg-terminal-border/40" />
              <div className="h-14 animate-pulse rounded bg-terminal-border/40" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[80px_1.2fr_1fr_1fr_1fr_1fr_80px] gap-3 border-b border-terminal-border/60 px-4 py-4">
            <div className="h-4 animate-pulse rounded bg-terminal-border/50" />
            <div className="h-4 animate-pulse rounded bg-terminal-border/40" />
            <div className="h-4 animate-pulse rounded bg-terminal-border/40" />
            <div className="h-4 animate-pulse rounded bg-terminal-border/40" />
            <div className="h-4 animate-pulse rounded bg-terminal-border/40" />
            <div className="h-4 animate-pulse rounded bg-terminal-border/40" />
            <div className="h-4 animate-pulse rounded bg-terminal-border/40" />
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyHint({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-terminal-border bg-terminal-panel/70 p-3">
      <div className="font-mono text-terminal-cyan">{label}</div>
      <div className="mt-1 text-terminal-muted">{text}</div>
    </div>
  );
}

function MobileMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "cyan" }) {
  const color = tone === "green" ? "text-terminal-green" : tone === "cyan" ? "text-terminal-cyan" : "text-terminal-text";
  return (
    <div className="rounded-md border border-terminal-border bg-terminal-bg/45 p-2">
      <div className="text-[9px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div>
      <div className={`mt-1 font-mono text-sm ${color}`}>{value}</div>
    </div>
  );
}
