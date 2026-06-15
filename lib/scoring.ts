import type { RiskLevel, TokenScores, TokenSnapshot, TokenWithScores } from "@/lib/types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const n = (value: number | null | undefined) => (Number.isFinite(value ?? NaN) ? Number(value) : 0);

export function ageHours(token: TokenSnapshot): number | null {
  if (!token.pairCreatedAt) return null;
  return Math.max(0, (Date.now() - token.pairCreatedAt) / 36e5);
}

export function buySellImbalance(token: TokenSnapshot): number | null {
  const buys = n(token.txns5mBuys) + n(token.txns1hBuys) * 0.35;
  const sells = n(token.txns5mSells) + n(token.txns1hSells) * 0.35;
  const total = buys + sells;
  if (!total) return null;
  return (buys - sells) / total;
}

export function liquidityToVolumeRatio(token: TokenSnapshot): number | null {
  const liquidity = n(token.liquidityUsd);
  const volume = n(token.volume24h);
  if (!liquidity || !volume) return null;
  return liquidity / volume;
}

export function volumeToLiquidityRatio(token: TokenSnapshot): number | null {
  const liquidity = n(token.liquidityUsd);
  const volume = n(token.volume24h);
  if (!liquidity || !volume) return null;
  return volume / liquidity;
}

export function scoreToken(token: TokenSnapshot): TokenScores {
  const liquidity = n(token.liquidityUsd);
  const volume5m = n(token.volume5m);
  const volume1h = n(token.volume1h);
  const volume6h = n(token.volume6h);
  const volume24h = n(token.volume24h);
  const change5m = n(token.priceChange5m);
  const change1h = n(token.priceChange1h);
  const change6h = n(token.priceChange6h);
  const change24h = n(token.priceChange24h);
  const imbalance = buySellImbalance(token) ?? 0;
  const age = ageHours(token);
  const volToLiq = liquidity ? volume24h / liquidity : 0;
  const acceleration = volume1h ? (volume5m * 12) / volume1h : volume5m > 0 ? 2 : 0;

  // momentumScore formula:
  // Weighted positive price momentum across 5m/1h/6h/24h, plus volume acceleration.
  // Short windows matter most for active traders; negative momentum is penalized by clamping.
  const momentumScore = clamp(
    50 +
      change5m * 1.8 +
      change1h * 1.2 +
      change6h * 0.45 +
      change24h * 0.18 +
      clamp((acceleration - 1) * 18, -20, 24)
  );

  // liquidityHealthScore formula:
  // Log-scaled liquidity depth minus penalties when 24h volume overwhelms available liquidity.
  // A healthy pool can absorb flow without extreme slippage or exhaustion.
  const liquidityDepth = clamp(Math.log10(Math.max(liquidity, 1)) * 16 - 45);
  const churnPenalty = volToLiq > 20 ? 24 : volToLiq > 10 ? 12 : volToLiq > 5 ? 5 : 0;
  const liquidityHealthScore = clamp(liquidityDepth - churnPenalty + (liquidity > 250000 ? 15 : 0));

  // flowScore formula:
  // Buy/sell imbalance is transformed from -1..1 into 0..100 and boosted by recent transaction count.
  // More recent buys relative to sells indicate active demand.
  const recentTxns = n(token.txns5mBuys) + n(token.txns5mSells);
  const flowScore = clamp((imbalance + 1) * 50 + clamp(Math.log10(Math.max(recentTxns, 1)) * 8, 0, 18));

  // riskScore formula:
  // Higher is safer. Start at 100, subtract for low liquidity, extreme volatility, thin data,
  // suspicious concentration placeholders, and very young pools.
  const lowLiquidityPenalty = liquidity < 25000 ? 38 : liquidity < 100000 ? 22 : liquidity < 250000 ? 10 : 0;
  const volatilityPenalty = Math.abs(change1h) > 60 ? 25 : Math.abs(change1h) > 35 ? 15 : Math.abs(change5m) > 25 ? 12 : 0;
  const dataPenalty = !token.priceUsd || !token.volume24h ? 12 : 0;
  const concentrationPlaceholderPenalty = token.marketCap && token.liquidityUsd && token.marketCap / token.liquidityUsd > 80 ? 8 : 0;
  const agePenalty = age !== null && age < 1 ? 12 : age !== null && age < 6 ? 6 : 0;
  const riskScore = clamp(100 - lowLiquidityPenalty - volatilityPenalty - dataPenalty - concentrationPlaceholderPenalty - agePenalty);

  // opportunityScore formula:
  // 32% momentum + 20% volume acceleration + 18% buy pressure + 18% liquidity depth
  // + 12% freshness, then penalties for low liquidity, extreme volatility, and concentration placeholders.
  const freshnessScore = age === null ? 45 : age < 2 ? 82 : age < 24 ? 74 : age < 168 ? 58 : 38;
  const volumeAccelerationScore = clamp(50 + (acceleration - 1) * 30 + Math.log10(Math.max(volume6h, 1)) * 3);
  const riskPenalty = (100 - riskScore) * 0.34;
  const opportunityScore = clamp(
    momentumScore * 0.32 +
      volumeAccelerationScore * 0.2 +
      flowScore * 0.18 +
      liquidityHealthScore * 0.18 +
      freshnessScore * 0.12 -
      riskPenalty
  );

  return {
    momentumScore: Math.round(momentumScore),
    liquidityHealthScore: Math.round(liquidityHealthScore),
    flowScore: Math.round(flowScore),
    riskScore: Math.round(riskScore),
    opportunityScore: Math.round(opportunityScore)
  };
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

export function enrichToken(token: TokenSnapshot): TokenWithScores {
  const scores = scoreToken(token);
  const base = n(token.priceUsd);
  const points = [-6, -4, -3, -1, 0, 1, 2, 3].map((step) => {
    const wave = 1 + (n(token.priceChange1h) / 100) * (step / 6) + Math.sin(step + base) * 0.01;
    return Number((base * Math.max(0.2, wave)).toPrecision(6));
  });

  return {
    ...token,
    scores,
    riskLevel: riskLevel(scores.riskScore),
    ageHours: ageHours(token),
    buySellImbalance: buySellImbalance(token),
    liquidityToVolumeRatio: liquidityToVolumeRatio(token),
    volumeToLiquidityRatio: volumeToLiquidityRatio(token),
    sparkline: points
  };
}
