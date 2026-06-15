"use client";

import { MetricGrid, PanelTitle } from "@/components/analysis/MomentumPanel";
import type { SmartMoneyMetrics } from "@/lib/analysis/types";
import { formatUsd } from "@/lib/utils";

export function SmartMoneyPanel({ metrics }: { metrics: SmartMoneyMetrics }) {
  const walletObserved = metrics.onchainWalletsAvailable;
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Smart Money Analysis" />
      <MetricGrid items={[
        ["Whale Buy Est.", `${metrics.whaleBuys}${metrics.whaleBuysIsEstimate ? " est" : ""}`],
        ["Accumulators", walletObserved ? String(metrics.recurringAccumulators) : "Unverified"],
        ["Wallet Quality", walletObserved ? `${metrics.walletQualityScore.toFixed(0)}` : "Neutral"],
        ["Inflow", `${metrics.smartMoneyInflow.toFixed(0)}`],
        ["Conviction", walletObserved ? `${metrics.WalletConvictionScore.toFixed(0)}` : "Neutral"],
        ["Whale Accum", `${metrics.WhaleAccumulationScore.toFixed(0)}`]
      ]} />
      <div className="mt-3 border border-terminal-amber/30 bg-terminal-amber/10 p-2 text-xs text-terminal-amber">
        {metrics.onchainWalletsAvailable
          ? "Wallet intelligence is enriched from top holders, deployer profile, Base RPC, Blockscout, and Alchemy where available. PnL remains unavailable until trade-level cost basis indexing is built."
          : "Wallet intelligence is not showing demo wallets. Only provider-flow estimates are shown until holder/deployer wallets are observed onchain."}
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        {metrics.walletSignals.map((signal, index) => (
          <div key={`${signal}-${index}`} className="border border-terminal-border bg-[#0a0f16] p-2 text-terminal-muted">{signal}</div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {!metrics.wallets.length && (
          <div className="border border-terminal-border bg-[#0a0f16] p-3 text-xs text-terminal-muted">
            No verified wallet rows yet. Add/enable holder indexing for this token to populate whale, deployer, LP, and active wallet profiles.
          </div>
        )}
        {metrics.wallets.map((wallet, index) => (
          <div key={`${wallet.address}-${wallet.category}-${index}`} className="border border-terminal-border bg-[#0a0f16] p-3 text-xs">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-terminal-cyan">{wallet.label}</span>
                  <span className="border border-terminal-border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{wallet.category}</span>
                  {wallet.dataConfidence && <span className="border border-terminal-green/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-terminal-green">{wallet.dataConfidence}</span>}
                </div>
                <div className="mt-1 font-mono text-terminal-muted">{wallet.address}</div>
                <div className="mt-1 text-terminal-muted">{wallet.lastAction}</div>
              </div>
              <div className="text-right font-mono text-terminal-text">
                {formatUsd(wallet.balanceUsd, 0)}
                <div className="text-terminal-green">Q{wallet.qualityScore.toFixed(0)} · C{wallet.convictionScore.toFixed(0)}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <WalletStat label="Token %" value={wallet.tokenOwnershipPct !== undefined ? `${wallet.tokenOwnershipPct.toFixed(2)}%` : "N/A"} />
              <WalletStat label="ETH" value={wallet.ethBalance !== undefined ? wallet.ethBalance.toFixed(3) : "N/A"} />
              <WalletStat label="Tx count" value={wallet.txCount ?? "N/A"} />
              <WalletStat label="Source" value={wallet.dataSource ?? "modeled"} />
            </div>
            {wallet.riskFlags?.length ? <div className="mt-2 text-terminal-amber">Flags: {wallet.riskFlags.join(", ")}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function WalletStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-terminal-border/70 bg-terminal-bg/60 p-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-terminal-text">{value}</div>
    </div>
  );
}
