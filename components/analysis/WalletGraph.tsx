"use client";

import { PanelTitle } from "@/components/analysis/MomentumPanel";
import type { WalletCluster } from "@/lib/analysis/types";

export function WalletGraph({ clusters }: { clusters: WalletCluster[] }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Wallet Cluster Analysis" />
      <div className="relative h-56 overflow-hidden border border-terminal-border bg-[#0a0f16]">
        <div className="absolute left-[12%] top-[35%] h-4 w-4 bg-terminal-green shadow-glow" />
        <div className="absolute left-[45%] top-[18%] h-4 w-4 bg-terminal-cyan shadow-glow" />
        <div className="absolute right-[18%] top-[55%] h-4 w-4 bg-terminal-amber shadow-glow" />
        <div className="absolute left-[20%] top-[42%] h-px w-[35%] rotate-[-17deg] bg-terminal-green/50" />
        <div className="absolute left-[49%] top-[31%] h-px w-[34%] rotate-[25deg] bg-terminal-amber/50" />
        <div className="absolute bottom-3 left-3 right-3 grid gap-2 text-xs">
          {clusters.map((cluster, index) => <div key={`${cluster.id}-${index}`} className="border border-terminal-border bg-terminal-bg/80 p-2"><span className="font-mono text-terminal-text">{cluster.label}</span><span className="float-right text-terminal-muted">INS {cluster.insiderProbabilityScore} · SYB {cluster.sybilProbabilityScore}</span><div className="mt-1 truncate font-mono text-terminal-muted">{cluster.wallets.join(" → ")}</div></div>)}
        </div>
      </div>
    </section>
  );
}
