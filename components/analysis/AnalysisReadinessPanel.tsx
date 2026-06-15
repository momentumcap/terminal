"use client";

import { DataConfidenceBadge } from "@/components/trust/DataConfidenceBadge";
import type { TokenAnalysis } from "@/lib/analysis/types";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

type GateStatus = "ready" | "watch" | "blocker";

type GateCheck = {
  label: string;
  status: GateStatus;
  detail: string;
};

export function AnalysisReadinessPanel({ analysis }: { analysis: TokenAnalysis }) {
  const checks = buildReadinessChecks(analysis);
  const blockers = checks.filter((check) => check.status === "blocker");
  const watches = checks.filter((check) => check.status === "watch");
  const ready = checks.filter((check) => check.status === "ready");
  const status: GateStatus = blockers.length ? "blocker" : watches.length ? "watch" : "ready";
  const headline = status === "blocker" ? "Do not treat this as complete intelligence yet" : status === "watch" ? "Usable, but verify before trading" : "Best available evidence looks usable";

  return (
    <section className={`border p-4 ${statusClass(status, "panel")}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center border ${statusClass(status, "icon")}`}>
            {status === "ready" ? <CheckCircle2 size={19} /> : status === "watch" ? <Info size={19} /> : <ShieldAlert size={19} />}
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-terminal-muted">Trading Decision Gate</div>
            <h2 className="mt-1 text-lg font-semibold text-terminal-text">{headline}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-terminal-muted">
              This panel summarizes whether the current analysis has enough evidence for a trader to rely on it. It does not approve a trade or declare the token safe.
            </p>
          </div>
        </div>
        <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center font-mono text-xs">
          <CountPill label="ready" value={ready.length} status="ready" />
          <CountPill label="watch" value={watches.length} status="watch" />
          <CountPill label="blockers" value={blockers.length} status="blocker" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-2 md:grid-cols-2">
          {checks.map((check) => (
            <div key={check.label} className="border border-terminal-border bg-terminal-bg/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm text-terminal-text">{check.label}</div>
                <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClass(check.status, "badge")}`}>{check.status}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-terminal-muted">{check.detail}</p>
            </div>
          ))}
        </div>

        <div className="border border-terminal-border bg-terminal-bg/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-terminal-text">Evidence Snapshot</div>
            {analysis.dataQuality && <DataConfidenceBadge confidence={analysis.dataQuality.confidence} />}
          </div>
          <div className="mt-3 grid gap-2 text-xs">
            <EvidenceRow label="Source mode" value={analysis.source} />
            <EvidenceRow label="Market sources" value={analysis.marketData.marketDataSources.join(" + ") || "unknown"} />
            <EvidenceRow label="Buy/sell windows" value={analysis.ownData?.transactionWindowsAvailable ? "BaseRPC observed pool logs" : "Provider fields only"} />
            <EvidenceRow label="Holder source" value={analysis.holders.source ?? "unknown"} />
            <EvidenceRow label="Holder confidence" value={analysis.holders.confidence ?? "low"} />
            <EvidenceRow label="Onchain mode" value={analysis.onchain?.dataQuality.isPartial ? "partial" : analysis.onchain ? "connected" : "unavailable"} />
          </div>
          <div className="mt-3 border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-xs text-terminal-amber">
            <div className="mb-1 flex items-center gap-2 font-mono uppercase tracking-[0.12em]">
              <AlertTriangle size={13} />
              Verify before acting
            </div>
            Confirm contract address, liquidity, sellability, holder count source, and buys/sells against at least one external source before risking capital.
          </div>
        </div>
      </div>
    </section>
  );
}

function buildReadinessChecks(analysis: TokenAnalysis): GateCheck[] {
  const quality = analysis.dataQuality;
  const criticalMissing = [...(quality?.missingFields ?? []), ...(quality?.estimatedFields ?? [])];
  const riskUnknown = analysis.executiveSummary.contractSafetyStatus === "Risk unknown" || analysis.risk.status === "Risk unknown";
  const liquidityUsd = analysis.liquidity.liquidityUsd ?? 0;
  const holderCount = analysis.holders.holderCount;
  const holderConfidence = analysis.holders.confidence ?? "low";
  const onchainPartial = analysis.onchain?.dataQuality.isPartial ?? true;
  const sourceCount = quality?.sourceCount ?? analysis.marketData.marketDataSources.length;
  const disagreementCount = quality?.disagreementWarnings.length ?? 0;

  return [
    {
      label: "Market data",
      status: analysis.source === "mock-fallback" ? "blocker" : sourceCount >= 2 ? "ready" : "watch",
      detail: analysis.source === "mock-fallback" ? "This analysis is using fallback data. It should not be used for trading decisions." : `${sourceCount} source path${sourceCount === 1 ? "" : "s"} contributed to the analysis.`
    },
    {
      label: "Source agreement",
      status: disagreementCount > 2 ? "blocker" : disagreementCount > 0 ? "watch" : "ready",
      detail: disagreementCount ? `${disagreementCount} disagreement warning${disagreementCount === 1 ? "" : "s"} are attached. Treat conflicting values as unresolved.` : "No material source disagreement is currently attached to this analysis."
    },
    {
      label: "Contract risk visibility",
      status: riskUnknown ? "blocker" : analysis.risk.status === "High-risk pattern detected" ? "watch" : "ready",
      detail: riskUnknown ? "Contract risk is unavailable or unknown. Unknown does not mean safe." : `Current contract risk language: ${analysis.risk.status}.`
    },
    {
      label: "Liquidity depth",
      status: liquidityUsd < 10_000 ? "blocker" : liquidityUsd < 50_000 ? "watch" : "ready",
      detail: liquidityUsd < 10_000 ? "Liquidity is too thin for reliable exits and market data can move violently." : `Liquidity observed near ${formatUsd(liquidityUsd)}.`
    },
    {
      label: "Holder evidence",
      status: holderCount === null || holderConfidence === "low" ? "watch" : analysis.holders.holderCountIsEstimate ? "watch" : "ready",
      detail: holderCount === null ? "Holder count is unavailable. Holder analysis is limited." : `${holderCount.toLocaleString()} holders shown${analysis.holders.holderCountIsEstimate ? " as an estimate" : ""} with ${holderConfidence} confidence.`
    },
    {
      label: "Onchain coverage",
      status: onchainPartial ? "watch" : "ready",
      detail: onchainPartial ? "Onchain/indexer coverage is partial. Some holder, deployer, or wallet claims may be incomplete." : "Onchain adapter returned connected data without partial-mode warnings."
    },
    {
      label: "Critical missing inputs",
      status: criticalMissing.length > 5 ? "blocker" : criticalMissing.length ? "watch" : "ready",
      detail: criticalMissing.length ? `${criticalMissing.slice(0, 5).join(", ")}${criticalMissing.length > 5 ? "..." : ""}` : "No critical missing or estimated fields are recorded in the trust summary."
    },
    {
      label: "Action language",
      status: analysis.tacticalSummary.confidence < 45 ? "blocker" : analysis.tacticalSummary.confidence < 70 ? "watch" : "ready",
      detail: `Tactical interpretation confidence is ${analysis.tacticalSummary.confidence}/100. Low-confidence narratives should stay conservative.`
    }
  ];
}

function CountPill({ label, value, status }: { label: string; value: number; status: GateStatus }) {
  return (
    <div className={`border p-2 ${statusClass(status, "badge")}`}>
      <div className="text-lg font-semibold">{value}</div>
      {label}
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-terminal-border/60 pb-2">
      <span className="text-terminal-muted">{label}</span>
      <span className="max-w-[60%] truncate font-mono text-terminal-text">{value}</span>
    </div>
  );
}

function statusClass(status: GateStatus, part: "panel" | "icon" | "badge") {
  const base = {
    ready: {
      panel: "border-terminal-green/30 bg-terminal-green/5",
      icon: "border-terminal-green/40 bg-terminal-green/10 text-terminal-green",
      badge: "border-terminal-green/40 bg-terminal-green/10 text-terminal-green"
    },
    watch: {
      panel: "border-terminal-amber/35 bg-terminal-amber/5",
      icon: "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber",
      badge: "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber"
    },
    blocker: {
      panel: "border-terminal-red/35 bg-terminal-red/5",
      icon: "border-terminal-red/40 bg-terminal-red/10 text-terminal-red",
      badge: "border-terminal-red/40 bg-terminal-red/10 text-terminal-red"
    }
  };
  return base[status][part];
}

function formatUsd(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
