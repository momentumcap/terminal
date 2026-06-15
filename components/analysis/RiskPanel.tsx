"use client";

import { MetricGrid, PanelTitle } from "@/components/analysis/MomentumPanel";
import type { DeployerIntelligence, ManipulationMetrics, RiskFlags } from "@/lib/analysis/types";

export function RiskPanel({ risk, deployer, manipulation }: { risk: RiskFlags; deployer: DeployerIntelligence; manipulation: ManipulationMetrics }) {
  const flags = Object.entries(risk).filter((entry) => typeof entry[1] === "boolean") as Array<[string, boolean]>;
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Risk & Contract Analysis" />
      <MetricGrid items={[
        ["Safety", `${risk.ContractSafetyScore.toFixed(0)}`],
        ["Rug Risk", `${risk.RugRiskScore.toFixed(0)}`],
        ["Honeypot", `${risk.HoneypotRiskScore.toFixed(0)}`],
        ["Deployer Rep", `${deployer.DeployerReputationScore.toFixed(0)}`],
        ["Manipulation", `${manipulation.ManipulationRiskScore.toFixed(0)}`],
        ["Prev Rugs", String(deployer.previousRugs)]
      ]} />
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {flags.slice(0, 12).map(([flag, active]) => <div key={flag} className={`border p-2 font-mono ${active ? "border-terminal-red/50 text-terminal-red" : "border-terminal-border text-terminal-muted"}`}>{flag}</div>)}
      </div>
    </section>
  );
}
