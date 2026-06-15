"use client";

import { PanelTitle } from "@/components/analysis/MomentumPanel";
import type { TradeabilityMetrics } from "@/lib/analysis/types";
import { formatUsd } from "@/lib/utils";

export function TradeabilityPanel({ metrics }: { metrics: TradeabilityMetrics }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Tradeability Analysis" />
      <div className="mb-3 border border-terminal-border bg-[#0a0f16] p-3 text-sm">Suggested max sizing estimate: <span className="font-mono text-terminal-green">{formatUsd(metrics.safeSizingUsd, 0)}</span></div>
      <div className="grid gap-2">
        {metrics.simulations.map((sim) => <div key={sim.sizeUsd} className="grid grid-cols-4 border border-terminal-border bg-[#0a0f16] p-2 font-mono text-xs"><span>{formatUsd(sim.sizeUsd, 0)}</span><span>{sim.estimatedSlippage}% slip</span><span>{sim.marketImpact}% impact</span><span className={sim.verdict === "safe" ? "text-terminal-green" : sim.verdict === "careful" ? "text-terminal-amber" : "text-terminal-red"}>{sim.verdict === "safe" ? "lower impact" : sim.verdict}</span></div>)}
      </div>
    </section>
  );
}
