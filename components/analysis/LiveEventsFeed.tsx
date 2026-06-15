"use client";

import type { AlertEvent } from "@/lib/analysis/types";

export function LiveEventsFeed({ events }: { events: AlertEvent[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-terminal-border bg-terminal-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-terminal-muted">Live Events Feed</div>
          <div className="mt-1 text-xs text-terminal-muted">Onchain, local wallet-indexer, and deterministic analysis signals.</div>
        </div>
        <div className="rounded-full border border-terminal-cyan/30 bg-terminal-cyan/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terminal-cyan">{events.length} events</div>
      </div>
      <div className="max-h-64 overflow-auto font-mono text-xs">
        {events.length === 0 ? <div className="p-4 text-terminal-muted">No actionable events detected.</div> : events.map((event, index) => (
          <div key={`${event.id}-${event.createdAt}-${index}`} className="grid gap-3 border-b border-terminal-border/70 px-4 py-2 md:grid-cols-[82px_170px_1fr_128px]">
            <span className="text-terminal-muted">{new Date(event.createdAt).toLocaleTimeString()}</span>
            <span className={event.severity === "critical" ? "text-terminal-red" : event.severity === "warning" ? "text-terminal-amber" : "text-terminal-green"}>{event.type.replaceAll("_", " ")}</span>
            <span>{event.message}</span>
            <span className="text-terminal-muted">{String(event.metrics.source ?? "analysis")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
