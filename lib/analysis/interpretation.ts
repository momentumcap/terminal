import type { TacticalSummary, TokenAnalysis, TrendClassification } from "@/lib/analysis/types";

export function classifyTrend(partial: Pick<TokenAnalysis, "momentum" | "liquidity" | "holders" | "risk" | "manipulation"> & { breakoutWatch?: TokenAnalysis["breakoutWatch"]; ageHours: number | null }): TrendClassification {
  if (partial.risk.RugRiskScore > 72 || partial.momentum.trendStrength < 22) return "Death Spiral";
  if (partial.momentum.volatility > 72 && partial.momentum.buyPressureRatio < 0.45) return "Exhaustion";
  if (partial.momentum.trendStrength < 40 && partial.momentum.buyPressureRatio < 0.48) return "Distribution";
  if (partial.ageHours !== null && partial.ageHours < 6) return "Launch Phase";
  if ((partial.breakoutWatch?.probabilityScore ?? partial.momentum.breakoutProbability) > 72) return "Breakout";
  if (partial.momentum.trendStrength > 68 && partial.liquidity.liquidityTrend > 55) return "Expansion";
  return "Accumulation";
}

export function buildTacticalInterpretation(analysis: Omit<TokenAnalysis, "tacticalSummary" | "liveEvents">): TacticalSummary {
  const inferredSignals: string[] = [];
  const risks: string[] = [];
  const confirmedFacts: string[] = [];
  const missingData = analysis.dataQuality?.missingFields ?? [];

  confirmedFacts.push(`Market data source: ${analysis.marketData.marketDataSources.join(" + ")}`);
  if (analysis.onchain?.holders?.totalHolders) confirmedFacts.push(`Indexer holder count: ${analysis.onchain.holders.totalHolders.toLocaleString()}`);
  if (analysis.onchain?.contractRisk) confirmedFacts.push(`Contract risk source: ${analysis.onchain.contractRisk.dataQuality.source}`);

  if (analysis.smartMoney.smartMoneyInflow > 62) inferredSignals.push("Likely accumulation based on observed wallet/flow inputs");
  if (analysis.holders.holderVelocity > 62) inferredSignals.push("Holder growth proxy is improving");
  if (analysis.liquidity.liquidityTrend > 58) inferredSignals.push("Liquidity trend is above baseline");
  if (analysis.momentum.buyPressureRatio > 0.58) inferredSignals.push("Buy pressure is elevated in available windows");
  if (analysis.breakoutWatch.probabilityScore > 68) inferredSignals.push(`${analysis.breakoutWatch.status}: breakout watch is inferred from volume, flow, compression, and liquidity inputs`);

  if (analysis.liquidity.liquidityFragilityScore > 55) risks.push("Liquidity fragility elevated relative to traded volume");
  if (analysis.holders.concentrationRiskScore > 55) risks.push("Top-holder concentration is elevated in sampled holder data");
  if (analysis.risk.RugRiskScore > 45) risks.push("Contract safety requires manual verification");
  if (analysis.manipulation.ManipulationRiskScore > 50) risks.push("Manipulation pattern risk is above comfort band");
  if (analysis.momentum.volatility > 65) risks.push("Elevated volatility can punish late entries");
  if (analysis.breakoutWatch.confidence === "low" && analysis.breakoutWatch.probabilityScore > 60) risks.push("Breakout watch confidence is low because supporting data is missing or risk penalties are elevated");
  if (!analysis.onchain?.contractRisk) risks.push("Contract risk unavailable");
  if (analysis.liquidity.liquidityUsd < 25_000) risks.push("Very low liquidity limits reliability of bullish interpretations");

  const qualityPenalty = analysis.dataQuality?.confidence === "low" ? 18 : analysis.dataQuality?.confidence === "medium" ? 8 : 0;
  const confidence = Math.round(Math.min(96, Math.max(30, analysis.scores.OpportunityScore * 0.45 + analysis.scores.RiskScore * 0.35 + analysis.scores.TradeabilityScore * 0.2 - qualityPenalty)));
  const canBullish = Boolean(analysis.onchain?.contractRisk) && analysis.liquidity.liquidityUsd >= 25_000;
  const stance = analysis.scores.RiskScore < 45 ? "HIGH RISK" : analysis.manipulation.ManipulationRiskScore > 58 ? "DISTRIBUTION RISK" : canBullish && analysis.scores.OpportunityScore > 68 ? "BULLISH STRUCTURE" : "TACTICAL NEUTRAL";
  const tacticalView = stance === "BULLISH STRUCTURE"
    ? "Momentum continuation is favored by available evidence while liquidity remains above threshold and buy pressure persists."
    : stance === "HIGH RISK"
      ? "Avoid oversized entries until contract, liquidity, and sell-path risks are independently verified."
      : stance === "DISTRIBUTION RISK"
        ? "Treat strength as tactical only; watch for coordinated exits and fake volume."
        : `Wait for cleaner confirmation. ${analysis.dataQuality?.confidence === "low" ? "Confidence is low because critical data is missing or stale." : "Current evidence is mixed or incomplete."}`;

  return {
    stance,
    confidence,
    confirmedFacts,
    inferredSignals: inferredSignals.length ? inferredSignals : ["No decisive offensive edge inferred yet"],
    bullish: inferredSignals.length ? inferredSignals : ["No decisive offensive edge inferred yet"],
    risks: risks.length ? risks : ["No critical public-data risk detected"],
    missingData,
    tacticalView
  };
}
