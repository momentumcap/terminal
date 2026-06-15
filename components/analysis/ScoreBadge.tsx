"use client";

import { cn } from "@/lib/utils";
import type { TrustedScore } from "@/lib/trust/types";

export function AnalysisScoreBadge({ label, score, inverse = false, trustedScore }: { label: string; score: number; inverse?: boolean; trustedScore?: TrustedScore }) {
  const strong = inverse ? score <= 35 : score >= 70;
  const mid = inverse ? score <= 60 : score >= 45;
  const tone = strong ? "border-terminal-green/50 bg-terminal-green/10 text-terminal-green shadow-glow" : mid ? "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber" : "border-terminal-red/45 bg-terminal-red/10 text-terminal-red";
  return (
    <div className={cn("border p-3", tone)}>
      <div className="text-[10px] uppercase tracking-[0.14em] opacity-80">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{score}</div>
      {trustedScore && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer opacity-80">{trustedScore.confidence} confidence</summary>
          <div className="mt-2 space-y-1 opacity-90">
            <div>{trustedScore.explanation}</div>
            <div>Inputs: {trustedScore.inputsUsed.join(", ")}</div>
            {trustedScore.inputsMissing.length ? <div>Missing: {trustedScore.inputsMissing.join(", ")}</div> : null}
          </div>
        </details>
      )}
    </div>
  );
}
