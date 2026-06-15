"use client";

import { cn } from "@/lib/utils";

export function CredibilityBadge({ score, label = "CR" }: { score: number; label?: string }) {
  const tone = score >= 75 ? "border-terminal-green/50 bg-terminal-green/10 text-terminal-green" : score >= 50 ? "border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber" : "border-terminal-red/50 bg-terminal-red/10 text-terminal-red";
  return <span className={cn("inline-flex min-w-14 justify-center border px-2 py-1 font-mono text-xs font-semibold", tone)}>{label} {score}</span>;
}
