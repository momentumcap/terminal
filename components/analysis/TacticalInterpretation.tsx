"use client";

import type { TacticalSummary } from "@/lib/analysis/types";

export function TacticalInterpretation({ summary }: { summary: TacticalSummary }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-lg font-semibold text-terminal-green">{summary.stance}</div>
        <div className="font-mono text-xs text-terminal-muted">CONF {summary.confidence}%</div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-terminal-muted">Confirmed Facts</div>
          <ul className="space-y-2 text-sm">{summary.confirmedFacts.map((item, index) => <li key={`fact-${item}-${index}`} className="border-l-2 border-terminal-cyan pl-3 text-terminal-text">{item}</li>)}</ul>
        </div>
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-terminal-muted">Inferred Signals</div>
          <ul className="space-y-2 text-sm">{summary.inferredSignals.map((item, index) => <li key={`inferred-${item}-${index}`} className="border-l-2 border-terminal-green pl-3 text-terminal-text">{item}</li>)}</ul>
        </div>
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-terminal-muted">Risks</div>
          <ul className="space-y-2 text-sm">{summary.risks.map((item, index) => <li key={`risk-${item}-${index}`} className="border-l-2 border-terminal-red pl-3 text-terminal-text">{item}</li>)}</ul>
        </div>
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-terminal-muted">Tactical View</div>
          <p className="text-sm leading-6 text-terminal-text">{summary.tacticalView}</p>
        </div>
      </div>
      {summary.missingData.length ? <div className="mt-3 border border-terminal-amber/30 bg-terminal-amber/10 p-2 text-xs text-terminal-amber">Missing data: {summary.missingData.join(", ")}</div> : null}
    </section>
  );
}
