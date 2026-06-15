"use client";

import type { TrustConfidence } from "@/lib/trust/types";

export function DataConfidenceBadge({ confidence }: { confidence: TrustConfidence }) {
  const tone = confidence === "high" ? "border-terminal-green/40 text-terminal-green" : confidence === "medium" ? "border-terminal-amber/40 text-terminal-amber" : "border-terminal-red/40 text-terminal-red";
  return <span className={`inline-flex border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${tone}`}>{confidence}</span>;
}
