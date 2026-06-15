"use client";

import { DataConfidenceBadge } from "@/components/trust/DataConfidenceBadge";
import type { TrustedScore } from "@/lib/trust/types";

export function ScoreExplanationDrawer({ score }: { score: TrustedScore }) {
  return (
    <details className="mt-2 border border-terminal-border bg-terminal-bg/60 p-2 text-xs">
      <summary className="cursor-pointer font-mono text-terminal-muted">Score evidence</summary>
      <div className="mt-2 space-y-2">
        <DataConfidenceBadge confidence={score.confidence} />
        <div>{score.explanation}</div>
        <div className="text-terminal-muted">Version: {score.version}</div>
        <div>Inputs used: {score.inputsUsed.join(", ") || "none"}</div>
        {score.inputsMissing.length ? <div className="text-terminal-amber">Missing: {score.inputsMissing.join(", ")}</div> : null}
        {score.penalties.length ? <div className="text-terminal-red">Penalties: {score.penalties.join("; ")}</div> : null}
        {score.boosts.length ? <div className="text-terminal-green">Boosts: {score.boosts.join("; ")}</div> : null}
      </div>
    </details>
  );
}
