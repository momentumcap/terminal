import { clamp, safe } from "@/lib/analysis/scoring";
import type { ManipulationMetrics } from "@/lib/analysis/types";
import type { TokenWithScores } from "@/lib/types";

export function analyzeManipulation(token: TokenWithScores): ManipulationMetrics {
  const volLiq = token.volumeToLiquidityRatio ?? 0;
  const buySellGap = Math.abs(token.buySellImbalance ?? 0) * 100;
  const washTradingRisk = clamp(volLiq * 4 + (safe(token.txns1hBuys) + safe(token.txns1hSells) > 2000 ? 12 : 0));
  const fakeVolumeRisk = clamp(volLiq > 12 ? 62 : volLiq * 5);
  const coordinatedBuyRisk = clamp(buySellGap + (safe(token.txns5mBuys) > 100 ? 12 : 0));
  const spoofedActivityRisk = clamp(safe(token.volume5m) > safe(token.volume1h) * 0.55 ? 58 : 22);
  const loopingLiquidityRisk = clamp(volLiq > 18 ? 74 : volLiq * 3);
  const artificialHolderGrowthRisk = clamp(token.ageHours !== null && token.ageHours < 1 ? 48 : 20);
  const ManipulationRiskScore = clamp(washTradingRisk * 0.22 + fakeVolumeRisk * 0.2 + coordinatedBuyRisk * 0.18 + spoofedActivityRisk * 0.16 + loopingLiquidityRisk * 0.14 + artificialHolderGrowthRisk * 0.1);

  return { washTradingRisk, fakeVolumeRisk, coordinatedBuyRisk, spoofedActivityRisk, loopingLiquidityRisk, artificialHolderGrowthRisk, ManipulationRiskScore };
}
