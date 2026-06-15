"use client";

import { DataConfidenceBadge } from "@/components/trust/DataConfidenceBadge";
import { StaleDataBadge } from "@/components/trust/StaleDataBadge";
import { SourceList } from "@/components/trust/SourceList";
import type { TrustedMetric } from "@/lib/trust/types";

export function MetricTooltip<T>({ metric }: { metric: TrustedMetric<T> }) {
  return (
    <div className="absolute left-0 top-full z-30 mt-2 hidden w-72 border border-terminal-border bg-[#080d13] p-3 text-left text-xs shadow-xl group-hover:block">
      <div className="mb-2 flex items-center gap-2">
        <DataConfidenceBadge confidence={metric.confidence} />
        <StaleDataBadge isStale={metric.isStale} />
        {metric.isEstimated && <span className="border border-terminal-amber/40 px-2 py-0.5 font-mono text-[10px] uppercase text-terminal-amber">estimated</span>}
      </div>
      <div className="text-terminal-muted">Source</div>
      <div className="font-mono text-terminal-text">{metric.source}</div>
      <div className="mt-2 text-terminal-muted">Sources tried</div>
      <SourceList sources={metric.sourcesTried} />
      <div className="mt-2 text-terminal-muted">Last updated</div>
      <div className="font-mono text-terminal-text">{metric.lastUpdated}</div>
      {metric.missingFields.length ? <div className="mt-2 text-terminal-amber">Missing: {metric.missingFields.join(", ")}</div> : null}
      {metric.warnings.length ? <div className="mt-2 text-terminal-amber">{metric.warnings.join(" ")}</div> : null}
    </div>
  );
}
