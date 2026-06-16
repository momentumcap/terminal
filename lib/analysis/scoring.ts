import type { AnalysisScores, HolderMetrics, LiquidityMetrics, ManipulationMetrics, MomentumMetrics, NarrativeMetrics, RiskFlags, SmartMoneyMetrics, TradeabilityMetrics } from "@/lib/analysis/types";
import type { OwnTransactionWindow } from "@/lib/onchain/uniswapV3";
import type { TokenWithScores } from "@/lib/types";

export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export const safe = (value: number | null | undefined, fallback = 0) => (Number.isFinite(value ?? NaN) ? Number(value) : fallback);

export function scoreMomentum(token: TokenWithScores, ownWindows: OwnTransactionWindow[] = []): MomentumMetrics {
  const v5 = safe(token.volume5m);
  const v1 = safe(token.volume1h);
  const c5 = safe(token.priceChange5m);
  const c1 = safe(token.priceChange1h);
  const c6 = safe(token.priceChange6h);
  const c24 = safe(token.priceChange24h);
  const tx5mBuys = token.txns5mBuys ?? null;
  const tx5mSells = token.txns5mSells ?? null;
  const tx1hBuys = token.txns1hBuys ?? null;
  const tx1hSells = token.txns1hSells ?? null;
  const tx6hBuys = token.txns6hBuys ?? null;
  const tx6hSells = token.txns6hSells ?? null;
  const tx24hBuys = token.txns24hBuys ?? null;
  const tx24hSells = token.txns24hSells ?? null;
  const providerWindows = [
    makeTransactionWindow("5m", tx5mBuys, tx5mSells, token.dexId),
    makeTransactionWindow("1h", tx1hBuys, tx1hSells, token.dexId),
    makeTransactionWindow("6h", tx6hBuys, tx6hSells, token.dexId),
    makeTransactionWindow("24h", tx24hBuys, tx24hSells, token.dexId)
  ];
  const ownWindowMap = new Map(ownWindows.map((window) => [window.window, window]));
  const onchainTransactionWindows = ownWindows.filter((window) => window.complete || window.indexedLogCount > 0);
  const transactionWindows = providerWindows.map((providerWindow) => {
    const ownWindow = ownWindowMap.get(providerWindow.window);
    if (!ownWindow || (!ownWindow.complete && ownWindow.indexedLogCount === 0)) return providerWindow;
    return {
      window: ownWindow.window,
      buys: ownWindow.buys,
      sells: ownWindow.sells,
      total: ownWindow.total,
      buyRatio: ownWindow.buyRatio,
      source: "BaseRPC" as const,
      poolAddress: ownWindow.poolAddress,
      complete: ownWindow.complete,
      fromBlock: ownWindow.fromBlock,
      toBlock: ownWindow.toBlock,
      indexedLogCount: ownWindow.indexedLogCount
    };
  });
  const observedBuys = transactionWindows.some((value) => value.buys !== null)
    ? transactionWindows.reduce((sum, window) => sum + safe(window.buys), 0)
    : 0;
  const observedSells = transactionWindows.some((value) => value.sells !== null)
    ? transactionWindows.reduce((sum, window) => sum + safe(window.sells), 0)
    : 0;
  const buyPressureRatio = observedBuys + observedSells ? observedBuys / (observedBuys + observedSells) : 0.5;
  const volumeAcceleration = v1 ? clamp(((v5 * 12) / v1) * 50) : 40;
  const consistencyHits = [c5, c1, c6, c24].filter((x) => x > 0).length;
  const momentumConsistency = consistencyHits * 25;
  const trendStrength = clamp(50 + c1 * 1.4 + c6 * 0.55 + c24 * 0.18);
  const volatility = clamp(Math.abs(c5) * 2.5 + Math.abs(c1) * 0.9);
  const volatilityCompression = clamp(100 - volatility + (Math.abs(c24) > Math.abs(c1) ? 12 : 0));
  const acceleration = clamp(volumeAcceleration * 0.7 + Math.max(c5, 0) * 1.2 + Math.max(c1, 0) * 0.6);
  const breakoutProbability = clamp(trendStrength * 0.34 + volumeAcceleration * 0.28 + buyPressureRatio * 100 * 0.24 + volatilityCompression * 0.14);
  const sustainedMomentumScore = clamp(momentumConsistency * 0.24 + trendStrength * 0.34 + acceleration * 0.22 + buyPressureRatio * 100 * 0.2);
  const base = safe(token.priceUsd, 0.001);

  return {
    priceMomentum: clamp(50 + c5 * 1.7 + c1 + c6 * 0.4),
    momentumConsistency,
    trendStrength,
    volatility,
    breakoutProbability,
    acceleration,
    volumeAcceleration,
    buyPressureRatio,
    trendConsistency: momentumConsistency,
    volatilityCompression,
    sustainedMomentumScore,
    priceSeries: [24, 18, 12, 6, 3, 1, 0].map((h) => ({ t: `${h}h`, price: Number((base * (1 - c24 / 100 * (h / 24) + Math.sin(h + base) * 0.01)).toPrecision(6)) })),
    volumeSeries: [
      makeVolumeBar("5m", token.volume5m, transactionWindows[0]),
      makeVolumeBar("1h", token.volume1h, transactionWindows[1]),
      makeVolumeBar("6h", token.volume6h, transactionWindows[2]),
      makeVolumeBar("24h", token.volume24h, transactionWindows[3])
    ],
    transactionWindows,
    providerTransactionWindows: providerWindows,
    onchainTransactionWindows,
    heatmap: [
      { window: "5m", score: clamp(50 + c5 * 2) },
      { window: "1h", score: clamp(50 + c1 * 1.4) },
      { window: "6h", score: clamp(50 + c6 * 0.7) },
      { window: "24h", score: clamp(50 + c24 * 0.3) }
    ]
  };
}

function makeVolumeBar(t: string, volume: number | null, window: MomentumMetrics["transactionWindows"][number]) {
  return {
    t,
    volume,
    buys: window.buys,
    sells: window.sells,
    source: window.source === "BaseRPC" ? "base_rpc" as const : window.source === "Unavailable" ? "unavailable" as const : "provider_raw" as const
  };
}

function makeTransactionWindow(window: "5m" | "1h" | "6h" | "24h", buys: number | null, sells: number | null, dexId: string) {
  const unavailable = buys === null && sells === null;
  const total = unavailable ? null : safe(buys) + safe(sells);
  return {
    window,
    buys,
    sells,
    total,
    buyRatio: total === null ? null : safe(buys) / Math.max(total, 1),
    source: unavailable ? "Unavailable" as const : dexId === "geckoterminal" ? "GeckoTerminal" as const : "DexScreener" as const
  };
}

export function scoreLiquidity(token: TokenWithScores): LiquidityMetrics {
  const liquidity = safe(token.liquidityUsd);
  const volume = safe(token.volume24h);
  const volumeLiquidityRatio = liquidity ? volume / liquidity : 0;
  const liquidityEfficiency = clamp(100 - Math.abs(volumeLiquidityRatio - 3) * 10);
  const liquidityFragilityScore = clamp((liquidity < 50000 ? 38 : liquidity < 150000 ? 22 : 8) + (volumeLiquidityRatio > 12 ? 26 : volumeLiquidityRatio > 7 ? 12 : 0));

  return {
    liquidityUsd: liquidity,
    lpGrowth: clamp(50 + safe(token.priceChange6h) * 0.5 + Math.log10(Math.max(liquidity, 1)) * 3),
    liquidityConcentration: clamp(token.marketCap && liquidity ? (token.marketCap / liquidity) * 0.7 : 35),
    liquidityTrend: clamp(50 + safe(token.priceChange1h) * 0.7 + (volumeLiquidityRatio > 1 ? 8 : -4)),
    liquidityEfficiency,
    volumeLiquidityRatio,
    liquidityFragilityScore,
    suspiciousLpConcentration: liquidity > 0 && safe(token.marketCap) / liquidity > 80,
    suddenLpRemoval: safe(token.priceChange5m) < -18 && volumeLiquidityRatio > 8,
    liquiditySpike: volumeLiquidityRatio > 10 && safe(token.priceChange1h) > 12,
    slippageEstimates: [500, 1000, 5000, 10000].map((sizeUsd) => {
      const impact = liquidity ? (sizeUsd / liquidity) * 100 * (1 + volumeLiquidityRatio / 12) : 99;
      return { sizeUsd, estimatedSlippage: Number(clamp(impact * 0.65, 0.05, 99).toFixed(2)), marketImpact: Number(clamp(impact, 0.05, 99).toFixed(2)) };
    })
  };
}

export function scoreHolders(token: TokenWithScores): HolderMetrics {
  const freshnessBoost = token.ageHours !== null && token.ageHours < 24 ? 14 : 0;
  const modeledHolderCount = Math.round(180 + Math.log10(Math.max(safe(token.volume24h), 1)) * 190 + freshnessBoost * 12);
  const whaleConcentration = clamp(safe(token.marketCap) && safe(token.liquidityUsd) ? (safe(token.marketCap) / safe(token.liquidityUsd)) * 0.35 : 42);
  const holderDistributionQuality = clamp(100 - whaleConcentration * 0.62 + Math.log10(modeledHolderCount) * 8);
  const holderVelocity = clamp(45 + safe(token.priceChange1h) * 0.8 + safe(token.volume1h) / Math.max(safe(token.volume24h), 1) * 240);
  const holderHealthScore = clamp(holderDistributionQuality * 0.45 + holderVelocity * 0.32 + Math.min(modeledHolderCount / 20, 100) * 0.23);

  return {
    holderCount: null,
    holderCountIsEstimate: false,
    holderCountGrowth: clamp(holderVelocity * 0.75),
    holderVelocity,
    whaleConcentration,
    top10Ownership: clamp(18 + whaleConcentration * 0.42),
    top25Ownership: clamp(31 + whaleConcentration * 0.52),
    deployerOwnership: clamp(2 + whaleConcentration * 0.08),
    holderDistributionQuality,
    holderHealthScore,
    concentrationRiskScore: clamp(whaleConcentration * 1.05),
    source: "market-flow heuristic",
    confidence: "low",
    warnings: ["Exact holder count requires an indexer. Market-flow holder heuristics are used for scoring only and are not displayed as actual holders."],
    growthSeries: [],
    ownershipDistribution: [
      { bucket: "Whales", ownership: clamp(whaleConcentration) },
      { bucket: "Smart", ownership: 18 },
      { bucket: "Retail", ownership: clamp(100 - whaleConcentration - 18) }
    ]
  };
}

export function aggregateScores(momentum: MomentumMetrics, liquidity: LiquidityMetrics, holders: HolderMetrics, smart: SmartMoneyMetrics, narrative: NarrativeMetrics, tradeability: TradeabilityMetrics, risk: RiskFlags, manipulation: ManipulationMetrics): AnalysisScores {
  // MomentumScore formula: trend strength, volume acceleration, buy pressure, consistency, and compression.
  const MomentumScore = clamp(momentum.trendStrength * 0.28 + momentum.volumeAcceleration * 0.22 + momentum.buyPressureRatio * 100 * 0.18 + momentum.momentumConsistency * 0.17 + momentum.volatilityCompression * 0.15);
  // LiquidityHealthScore formula: liquidity efficiency and trend minus fragility and concentration penalties.
  const LiquidityHealthScore = clamp(liquidity.liquidityEfficiency * 0.42 + liquidity.liquidityTrend * 0.24 + liquidity.lpGrowth * 0.2 - liquidity.liquidityFragilityScore * 0.28 + 18);
  // HolderHealthScore formula: holder distribution, holder velocity, and low concentration.
  const HolderHealthScore = clamp(holders.holderDistributionQuality * 0.42 + holders.holderVelocity * 0.28 + (100 - holders.concentrationRiskScore) * 0.3);
  // SmartMoneyScore formula: quality wallets, whale accumulation, profitable participation, and net inflow.
  const SmartMoneyScore = clamp(smart.walletQualityScore * 0.32 + smart.WhaleAccumulationScore * 0.25 + smart.profitableWalletParticipation * 0.22 + smart.smartMoneyInflow * 0.21);
  // NarrativeStrengthScore formula: social velocity, mention acceleration, community growth, and category momentum.
  const NarrativeStrengthScore = clamp(narrative.socialVelocity * 0.32 + narrative.mentionAcceleration * 0.24 + narrative.communityGrowth * 0.2 + narrative.narrativeMomentum * 0.24);
  // TradeabilityScore formula: safe execution sizing minus entry, exit, and exhaustion difficulty.
  const TradeabilityScore = clamp(tradeability.TradeabilityScore);
  // RugRiskScore formula: contract permission risk, honeypot signals, deployer-linked concentration, and failed simulation flags.
  const RugRiskScore = clamp(risk.RugRiskScore);
  // ManipulationRiskScore formula: wash trading, fake volume, coordinated buys, spoofing, looping LP, and holder growth anomalies.
  const ManipulationRiskScore = clamp(manipulation.ManipulationRiskScore);
  // RiskScore formula: inverse of rug/manipulation risk with safety and tradeability support.
  const RiskScore = clamp(100 - RugRiskScore * 0.46 - ManipulationRiskScore * 0.24 + risk.ContractSafetyScore * 0.18 + TradeabilityScore * 0.12);
  // OpportunityScore formula: offensive momentum, smart money, liquidity, holders, narrative, and tradeability minus risk drag.
  const OpportunityScore = clamp(MomentumScore * 0.25 + SmartMoneyScore * 0.18 + LiquidityHealthScore * 0.16 + HolderHealthScore * 0.13 + NarrativeStrengthScore * 0.1 + TradeabilityScore * 0.12 - (100 - RiskScore) * 0.2);

  return { MomentumScore: Math.round(MomentumScore), OpportunityScore: Math.round(OpportunityScore), RiskScore: Math.round(RiskScore), LiquidityHealthScore: Math.round(LiquidityHealthScore), SmartMoneyScore: Math.round(SmartMoneyScore), HolderHealthScore: Math.round(HolderHealthScore), NarrativeStrengthScore: Math.round(NarrativeStrengthScore), TradeabilityScore: Math.round(TradeabilityScore), RugRiskScore: Math.round(RugRiskScore), ManipulationRiskScore: Math.round(ManipulationRiskScore) };
}
