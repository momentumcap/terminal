import { clamp, safe } from "@/lib/analysis/scoring";
import type { LiquidityMetrics, TradeabilityMetrics } from "@/lib/analysis/types";
import type { TokenWithScores } from "@/lib/types";

export function analyzeTradeability(token: TokenWithScores, liquidity: LiquidityMetrics): TradeabilityMetrics {
  const entryDifficulty = clamp(liquidity.volumeLiquidityRatio * 4 + liquidity.liquidityFragilityScore * 0.35);
  const exitDifficulty = clamp(entryDifficulty + Math.max(0, -(token.buySellImbalance ?? 0)) * 28);
  const liquidityExhaustionRisk = clamp(liquidity.liquidityFragilityScore * 0.8 + (liquidity.liquidityUsd < 100000 ? 16 : 0));
  const simulations = liquidity.slippageEstimates.map((item) => ({ ...item, verdict: item.estimatedSlippage < 2 ? "safe" as const : item.estimatedSlippage < 7 ? "careful" as const : "avoid" as const }));
  const safeSizingUsd = simulations.find((item) => item.verdict === "avoid")?.sizeUsd ?? 10000;
  const TradeabilityScore = clamp(100 - entryDifficulty * 0.28 - exitDifficulty * 0.26 - liquidityExhaustionRisk * 0.3 + Math.log10(Math.max(safe(token.liquidityUsd), 1)) * 3);
  return { entryDifficulty, exitDifficulty, liquidityExhaustionRisk, TradeabilityScore, safeSizingUsd, simulations };
}
