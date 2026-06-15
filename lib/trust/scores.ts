import type { TrustedScore, TrustConfidence } from "@/lib/trust/types";

const SCORE_VERSION = "trust-score-v1";

export function createTrustedScore(input: {
  score: number | null;
  label: string;
  confidence?: TrustConfidence;
  inputsUsed: string[];
  inputsMissing?: string[];
  penalties?: string[];
  boosts?: string[];
  explanation: string;
}): TrustedScore {
  const missing = input.inputsMissing ?? [];
  const confidence = missing.length ? "low" : input.confidence ?? "medium";
  return {
    score: input.score,
    label: input.label,
    version: SCORE_VERSION,
    confidence,
    inputsUsed: input.inputsUsed,
    inputsMissing: missing,
    penalties: input.penalties ?? [],
    boosts: input.boosts ?? [],
    explanation: input.explanation,
    lastUpdated: new Date().toISOString()
  };
}

export function buildTrustedScores(scores: Record<string, number>, missingInputs: string[] = []): Record<string, TrustedScore> {
  return Object.fromEntries(Object.entries(scores).map(([label, score]) => [
    label,
    createTrustedScore({
      score,
      label,
      confidence: missingInputs.length ? "medium" : "high",
      inputsUsed: ["market data", "liquidity", "flow", "risk flags", "holder profile"],
      inputsMissing: missingInputs,
      penalties: score < 50 ? ["Weak or missing key inputs reduced the score."] : [],
      boosts: score >= 75 ? ["Strong observed inputs increased the score."] : [],
      explanation: `${label} is deterministic and should be read with its input coverage and confidence, not as a guarantee.`
    })
  ]));
}
