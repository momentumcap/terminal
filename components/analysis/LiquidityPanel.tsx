"use client";

import { MetricGrid, PanelTitle } from "@/components/analysis/MomentumPanel";
import type { LiquidityMetrics } from "@/lib/analysis/types";
import { formatUsd } from "@/lib/utils";

export function LiquidityPanel({ metrics }: { metrics: LiquidityMetrics }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Liquidity Analysis" />
      <MetricGrid items={[
        ["Liquidity", formatUsd(metrics.liquidityUsd, 1)],
        ["LP Growth", `${metrics.lpGrowth.toFixed(0)}`],
        ["Vol/Liq", metrics.volumeLiquidityRatio.toFixed(2)],
        ["Efficiency", `${metrics.liquidityEfficiency.toFixed(0)}`],
        ["Fragility", `${metrics.liquidityFragilityScore.toFixed(0)}`],
        ["LP Concentration", `${metrics.liquidityConcentration.toFixed(0)}`]
      ]} />
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Flag label="LP removal" active={metrics.suddenLpRemoval} />
        <Flag label="Liquidity spike" active={metrics.liquiditySpike} />
        <Flag label="Suspicious concentration" active={metrics.suspiciousLpConcentration} />
        <Flag label="Depth simulated" active />
      </div>
    </section>
  );
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return <div className={`border p-2 font-mono ${active ? "border-terminal-amber/40 text-terminal-amber" : "border-terminal-border text-terminal-muted"}`}>{label}</div>;
}
