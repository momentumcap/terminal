"use client";

import { AnalysisScoreBadge } from "@/components/analysis/ScoreBadge";
import { DataQualityPanel } from "@/components/trust/DataQualityPanel";
import type { TokenAnalysis } from "@/lib/analysis/types";
import { freshnessLabel } from "@/lib/freshness";

export function ExecutiveSummary({ analysis }: { analysis: TokenAnalysis }) {
  const s = analysis.executiveSummary;
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">Executive Summary</div>
          <h2 className="mt-1 font-mono text-2xl font-semibold">{analysis.symbol} Intelligence File</h2>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] px-3 py-2 font-mono text-xs text-terminal-cyan">{s.currentTrendClassification}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <AnalysisScoreBadge label="Opportunity" score={s.opportunityScore} trustedScore={analysis.trustedScores?.OpportunityScore} />
        <AnalysisScoreBadge label="Risk Confidence" score={s.riskScore} trustedScore={analysis.trustedScores?.RiskScore} />
        <AnalysisScoreBadge label="Momentum" score={s.momentumScore} trustedScore={analysis.trustedScores?.MomentumScore} />
        <AnalysisScoreBadge label="Liquidity" score={s.liquidityHealthScore} trustedScore={analysis.trustedScores?.LiquidityHealthScore} />
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-terminal-border bg-[#0a0f16] p-3"><span className="text-terminal-muted">Smart money</span><div className="font-mono text-terminal-text">{s.smartMoneyActivity}</div></div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3"><span className="text-terminal-muted">Holder growth</span><div className="font-mono text-terminal-text">{s.holderGrowthStatus}</div></div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3"><span className="text-terminal-muted">Contract</span><div className="font-mono text-terminal-text">{s.contractSafetyStatus}</div></div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <span className="text-terminal-muted">Sources</span>
          <div className="font-mono text-terminal-text">{analysis.marketData.marketDataSources.join(" + ")}</div>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3"><span className="text-terminal-muted">Updated</span><div className="font-mono text-terminal-text">{freshnessLabel(analysis.updatedAt)}</div></div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <span className="text-terminal-muted">Market primary</span>
          <div className="font-mono text-terminal-text">{analysis.marketData.primaryMarketSource}</div>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <span className="text-terminal-muted">Swap windows</span>
          <div className="font-mono text-terminal-text">{analysis.ownData?.transactionWindowsAvailable ? "BaseRPC raw logs" : "Provider raw fields"}</div>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <span className="text-terminal-muted">Onchain confidence</span>
          <div className="font-mono text-terminal-text">{analysis.onchain?.dataQuality.confidence ?? "low"}</div>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <span className="text-terminal-muted">Indexer mode</span>
          <div className="font-mono text-terminal-text">{analysis.onchain?.dataQuality.isPartial ? "Partial" : "Connected"}</div>
        </div>
      </div>
      {analysis.onchain && (
        <div className="mt-3 grid gap-2 text-xs lg:grid-cols-3">
          <div className="border border-terminal-border bg-[#0a0f16] p-3">
            <span className="text-terminal-muted">Data sources used</span>
            <div className="mt-1 font-mono text-terminal-text">{analysis.onchain.dataQuality.sourcesTried.join(" + ")}</div>
          </div>
          <div className="border border-terminal-border bg-[#0a0f16] p-3">
            <span className="text-terminal-muted">Missing fields</span>
            <div className="mt-1 font-mono text-terminal-text">{analysis.onchain.dataQuality.missingFields.slice(0, 4).join(", ") || "None"}</div>
          </div>
          <div className="border border-terminal-border bg-[#0a0f16] p-3">
            <span className="text-terminal-muted">Warnings</span>
            <div className="mt-1 font-mono text-terminal-text">{analysis.onchain.dataQuality.warnings.slice(0, 2).join(" | ") || "None"}</div>
          </div>
        </div>
      )}
      {analysis.dataQuality && <div className="mt-3"><DataQualityPanel quality={analysis.dataQuality} /></div>}
      <div className="mt-3 border border-terminal-cyan/20 bg-terminal-cyan/5 p-3 text-xs text-terminal-muted">{analysis.marketData.sourcePolicy}</div>
    </section>
  );
}
