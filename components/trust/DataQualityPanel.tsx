"use client";

import { DataConfidenceBadge } from "@/components/trust/DataConfidenceBadge";
import { SourceDisagreementWarning } from "@/components/trust/SourceDisagreementWarning";
import { SourceList } from "@/components/trust/SourceList";
import type { DataQuality } from "@/lib/trust/types";

export function DataQualityPanel({ quality }: { quality: DataQuality }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4 text-xs">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-mono uppercase tracking-[0.14em] text-terminal-muted">Data Quality</div>
        <DataConfidenceBadge confidence={quality.confidence} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-terminal-muted">Sources used</div>
          <SourceList sources={quality.sourcesUsed} />
        </div>
        <div>
          <div className="text-terminal-muted">Sources failed/missing</div>
          <SourceList sources={quality.sourcesFailed} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Pill label="Stale" values={quality.staleFields} />
        <Pill label="Estimated" values={quality.estimatedFields} />
        <Pill label="Missing" values={quality.missingFields} />
      </div>
      <div className="mt-3"><SourceDisagreementWarning warnings={quality.disagreementWarnings} /></div>
    </section>
  );
}

function Pill({ label, values }: { label: string; values: string[] }) {
  return <div className="border border-terminal-border bg-[#0a0f16] p-2"><span className="text-terminal-muted">{label}: </span><span className="font-mono">{values.length ? values.join(", ") : "none"}</span></div>;
}
