"use client";

import { cn } from "@/lib/utils";
import type { TrustedScore } from "@/lib/trust/types";

export function ScoreBadge({ score, label, className, trustedScore }: { score: number; label?: string; className?: string; trustedScore?: TrustedScore }) {
  const tone = score >= 75 ? "border-terminal-green/40 bg-terminal-green/10 text-terminal-green" : score >= 50 ? "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber" : "border-terminal-red/40 bg-terminal-red/10 text-terminal-red";
  return (
    <span title={trustedScore ? `${trustedScore.label}: ${trustedScore.explanation} Confidence: ${trustedScore.confidence}` : undefined} className={cn("inline-flex min-w-14 items-center justify-center rounded-full border px-2.5 py-1 font-mono text-xs font-semibold", tone, trustedScore?.confidence === "low" && "opacity-70", className)}>
      {label ? `${label} ` : ""}
      {score}
    </span>
  );
}
