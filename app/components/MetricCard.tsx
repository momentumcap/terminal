"use client";

import { cn } from "@/lib/utils";
import { MetricTooltip } from "@/components/trust/MetricTooltip";
import type { TrustedMetric } from "@/lib/trust/types";

export function MetricCard({ label, value, accent = "neutral", metric }: { label: string; value: string; accent?: "neutral" | "green" | "amber" | "red" | "cyan"; metric?: TrustedMetric<unknown> }) {
  const color = {
    neutral: "text-terminal-text",
    green: "text-terminal-green",
    amber: "text-terminal-amber",
    red: "text-terminal-red",
    cyan: "text-terminal-cyan"
  }[accent];
  return (
    <div className={cn("group relative rounded-lg border border-terminal-border bg-terminal-bg/55 p-3 transition hover:border-terminal-cyan/30", metric?.isStale && "opacity-65")}>
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
        <span>{label}</span>
        {metric && <span className={metric.confidence === "high" ? "text-terminal-green" : metric.confidence === "medium" ? "text-terminal-amber" : "text-terminal-red"}>{metric.confidence}</span>}
      </div>
      <div className={cn("mt-2 truncate font-mono text-sm font-semibold", color)}>{value}</div>
      {metric?.isEstimated && <div className="mt-1 font-mono text-[10px] uppercase text-terminal-amber">estimated</div>}
      {metric && <MetricTooltip metric={metric} />}
    </div>
  );
}
