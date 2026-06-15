import type { BreakoutSetupStatus, BreakoutWatchMetrics, HolderMetrics, LiquidityMetrics, ManipulationMetrics, MomentumMetrics, NarrativeMetrics, RiskFlags, SmartMoneyMetrics, TradeabilityMetrics } from "@/lib/analysis/types";
import { clamp, safe } from "@/lib/analysis/scoring";
import type { TokenWithScores } from "@/lib/types";

export function analyzeBreakoutWatch({
  token,
  momentum,
  liquidity,
  holders,
  smartMoney,
  narrative,
  tradeability,
  risk,
  manipulation,
  missingData = []
}: {
  token: TokenWithScores;
  momentum: MomentumMetrics;
  liquidity: LiquidityMetrics;
  holders: HolderMetrics;
  smartMoney: SmartMoneyMetrics;
  narrative: NarrativeMetrics;
  tradeability: TradeabilityMetrics;
  risk: RiskFlags;
  manipulation: ManipulationMetrics;
  missingData?: string[];
}): BreakoutWatchMetrics {
  const currentPriceUsd = positiveOrNull(token.priceUsd);
  const c5 = safe(token.priceChange5m);
  const c1 = safe(token.priceChange1h);
  const c6 = safe(token.priceChange6h);
  const c24 = safe(token.priceChange24h);
  const volume5m = safe(token.volume5m);
  const volume1h = safe(token.volume1h);
  const volume6h = safe(token.volume6h);
  const volume24h = safe(token.volume24h);
  const liquidityUsd = safe(token.liquidityUsd);
  const buyPressureRatio = momentum.buyPressureRatio;
  const volumeAccelerationScore = momentum.volumeAcceleration;
  const buyPressureTrendScore = clamp((buyPressureRatio - 0.5) * 180 + 50 + (c5 > 0 ? 8 : 0) + (c1 > 0 ? 8 : 0));
  const priceCompressionScore = clamp(momentum.volatilityCompression * 0.78 + (Math.abs(c1) < Math.abs(c24) ? 12 : 0) + (c5 > -2 && c1 > -6 ? 8 : -8));
  const resistanceRetestScore = clamp(50 + Math.max(c1, 0) * 1.2 + Math.max(c6, 0) * 0.45 + (c5 > -2 && c1 > 0 ? 12 : 0) - Math.max(-c5, 0) * 1.3);
  const liquiditySupportScore = clamp(liquidity.liquidityTrend * 0.42 + liquidity.liquidityEfficiency * 0.34 + (100 - liquidity.liquidityFragilityScore) * 0.24);
  const holderExpansionScore = clamp(holders.holderVelocity * 0.46 + holders.holderHealthScore * 0.34 + (100 - holders.concentrationRiskScore) * 0.2);
  const smartWalletInflowScore = clamp(smartMoney.smartMoneyInflow * 0.44 + smartMoney.WalletConvictionScore * 0.28 + smartMoney.WhaleAccumulationScore * 0.28);
  const socialMomentumScore = clamp(narrative.socialVelocity * 0.35 + narrative.mentionAcceleration * 0.35 + narrative.narrativeMomentum * 0.3);
  const riskPenaltyScore = clamp(
    risk.RugRiskScore * 0.32 +
    manipulation.ManipulationRiskScore * 0.26 +
    liquidity.liquidityFragilityScore * 0.22 +
    tradeability.liquidityExhaustionRisk * 0.12 +
    Math.max(0, 50 - liquiditySupportScore) * 0.08
  );

  // BreakoutProbability v1 formula, normalized 0-100:
  // volumeAcceleration 22% + buyPressureTrend 18% + priceCompression 15% +
  // resistanceRetest 15% + liquiditySupport 12% + holderExpansion 8% +
  // smartWalletInflow 6% + socialMomentum 4% - riskPenalty up to 30%.
  // This is intentionally a probability-of-setup score, not a prediction guarantee.
  const rawProbability =
    volumeAccelerationScore * 0.22 +
    buyPressureTrendScore * 0.18 +
    priceCompressionScore * 0.15 +
    resistanceRetestScore * 0.15 +
    liquiditySupportScore * 0.12 +
    holderExpansionScore * 0.08 +
    smartWalletInflowScore * 0.06 +
    socialMomentumScore * 0.04 -
    riskPenaltyScore * 0.3;
  const probabilityScore = Math.round(clamp(rawProbability));

  const resistanceLevelUsd = currentPriceUsd ? estimateResistance(currentPriceUsd, c1, c6, c24) : null;
  const supportLevelUsd = currentPriceUsd ? estimateSupport(currentPriceUsd, c1, c6) : null;
  const distanceToResistancePct = currentPriceUsd && resistanceLevelUsd
    ? Number((((resistanceLevelUsd - currentPriceUsd) / currentPriceUsd) * 100).toFixed(2))
    : null;

  const boosts: string[] = [];
  const penalties: string[] = [];
  const confirmedFacts: string[] = [];
  const inferredSignals: string[] = [];
  const confirmationTriggers: string[] = [];
  const invalidationTriggers: string[] = [];

  confirmedFacts.push(`Volume windows available: ${availableVolumeWindows({ volume5m, volume1h, volume6h, volume24h }).join(", ") || "none"}`);
  confirmedFacts.push(`Buy pressure ratio: ${(buyPressureRatio * 100).toFixed(1)}%`);
  confirmedFacts.push(`Liquidity: $${Math.round(liquidityUsd).toLocaleString()}`);

  if (volumeAccelerationScore >= 70) boosts.push("Volume acceleration is materially above baseline");
  if (buyPressureTrendScore >= 65) boosts.push("Available windows show sustained buy-side pressure");
  if (priceCompressionScore >= 65) boosts.push("Volatility compression suggests pressure is building before expansion");
  if (liquiditySupportScore >= 65) boosts.push("Liquidity support is strong enough for cleaner breakout follow-through");
  if (smartWalletInflowScore >= 65) boosts.push("Wallet-flow inputs lean toward accumulation");
  if (socialMomentumScore >= 65) boosts.push("Social/narrative momentum is supportive");

  if (risk.RugRiskScore > 45) penalties.push("Contract/rug risk lowers breakout reliability");
  if (manipulation.ManipulationRiskScore > 50) penalties.push("Possible manipulation lowers signal quality");
  if (liquidity.liquidityFragilityScore > 55) penalties.push("Liquidity fragility can turn a breakout into a failed squeeze");
  if (liquidityUsd < 25_000) penalties.push("Liquidity is too low for high-confidence breakout interpretation");
  if (tradeability.exitDifficulty > 65) penalties.push("Exit difficulty is elevated");
  if (missingData.length) penalties.push("Critical data is missing or partial");

  if (volumeAccelerationScore >= 60) inferredSignals.push("Volume expansion is starting before full price expansion");
  if (buyPressureTrendScore >= 60) inferredSignals.push("Buy pressure is improving across observed transaction windows");
  if (distanceToResistancePct !== null && distanceToResistancePct <= 8 && distanceToResistancePct >= -4) inferredSignals.push("Price is close enough to the modeled resistance zone to watch for confirmation");
  if (priceCompressionScore >= 60) inferredSignals.push("Compression-plus-flow setup is forming");

  confirmationTriggers.push("5m volume annualized above the 1h baseline while price remains above support");
  confirmationTriggers.push("Buy ratio holds above 58% through the next refresh window");
  confirmationTriggers.push("Price closes above the modeled resistance zone without immediate liquidity withdrawal");
  confirmationTriggers.push("Liquidity remains stable or increases during the move");

  invalidationTriggers.push("Buy ratio falls below 48% while volume remains elevated");
  invalidationTriggers.push("Price rejects resistance and loses the modeled support zone");
  invalidationTriggers.push("Liquidity drops sharply or slippage estimates expand");
  invalidationTriggers.push("Contract, holder, or manipulation risk escalates before confirmation");

  const confidence = buildConfidence({ missingData, liquidityUsd, probabilityScore, riskPenaltyScore, volume1h, volume24h });
  const status = classifyBreakoutStatus(probabilityScore);
  const explanation = buildExplanation(status, confidence, boosts, penalties);

  return {
    probabilityScore,
    status,
    confidence,
    resistanceLevelUsd,
    supportLevelUsd,
    currentPriceUsd,
    distanceToResistancePct,
    volumeAccelerationScore: Math.round(volumeAccelerationScore),
    buyPressureTrendScore: Math.round(buyPressureTrendScore),
    priceCompressionScore: Math.round(priceCompressionScore),
    resistanceRetestScore: Math.round(resistanceRetestScore),
    liquiditySupportScore: Math.round(liquiditySupportScore),
    holderExpansionScore: Math.round(holderExpansionScore),
    smartWalletInflowScore: Math.round(smartWalletInflowScore),
    socialMomentumScore: Math.round(socialMomentumScore),
    riskPenaltyScore: Math.round(riskPenaltyScore),
    boosts,
    penalties,
    confirmationTriggers,
    invalidationTriggers,
    confirmedFacts,
    inferredSignals: inferredSignals.length ? inferredSignals : ["No decisive pre-breakout structure inferred yet"],
    missingData,
    explanation,
    updatedAt: new Date().toISOString()
  };
}

function classifyBreakoutStatus(score: number): BreakoutSetupStatus {
  if (score >= 90) return "Active breakout conditions";
  if (score >= 75) return "High-conviction setup";
  if (score >= 60) return "Setup forming";
  if (score >= 40) return "Early watch";
  return "No setup";
}

function buildConfidence({
  missingData,
  liquidityUsd,
  probabilityScore,
  riskPenaltyScore,
  volume1h,
  volume24h
}: {
  missingData: string[];
  liquidityUsd: number;
  probabilityScore: number;
  riskPenaltyScore: number;
  volume1h: number;
  volume24h: number;
}): "high" | "medium" | "low" {
  if (missingData.length > 3 || liquidityUsd < 15_000 || riskPenaltyScore > 62 || !volume1h || !volume24h) return "low";
  if (missingData.length || liquidityUsd < 75_000 || riskPenaltyScore > 42 || probabilityScore < 55) return "medium";
  return "high";
}

function buildExplanation(status: BreakoutSetupStatus, confidence: "high" | "medium" | "low", boosts: string[], penalties: string[]) {
  const base = status === "No setup"
    ? "No reliable pre-breakout structure is visible from the current data."
    : `${status} detected from volume, flow, compression, liquidity, wallet, and risk inputs.`;
  const caution = confidence === "low"
    ? "Confidence is low, so this should be treated as a watchlist signal only."
    : confidence === "medium"
      ? "Confidence is medium; wait for confirmation triggers before acting."
      : "Confidence is high enough to monitor actively, but still requires execution and risk checks.";
  const strongest = boosts[0] ? ` Strongest boost: ${boosts[0]}.` : "";
  const weakest = penalties[0] ? ` Main penalty: ${penalties[0]}.` : "";
  return `${base} ${caution}${strongest}${weakest}`;
}

function estimateResistance(price: number, c1: number, c6: number, c24: number) {
  const expansion = clamp(Math.max(c1, 0) * 0.08 + Math.max(c6, 0) * 0.035 + Math.max(c24, 0) * 0.012, 1.5, 16);
  return Number((price * (1 + expansion / 100)).toPrecision(8));
}

function estimateSupport(price: number, c1: number, c6: number) {
  const cushion = clamp(Math.max(Math.abs(Math.min(c1, 0)), Math.abs(Math.min(c6, 0)) * 0.35) + 2, 2, 18);
  return Number((price * (1 - cushion / 100)).toPrecision(8));
}

function availableVolumeWindows(volumes: { volume5m: number; volume1h: number; volume6h: number; volume24h: number }) {
  return [
    volumes.volume5m > 0 ? "5m" : null,
    volumes.volume1h > 0 ? "1h" : null,
    volumes.volume6h > 0 ? "6h" : null,
    volumes.volume24h > 0 ? "24h" : null
  ].filter(Boolean) as string[];
}

function positiveOrNull(value: number | null | undefined) {
  const numeric = safe(value);
  return numeric > 0 ? numeric : null;
}
