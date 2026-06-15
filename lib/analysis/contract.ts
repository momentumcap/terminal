import { clamp, safe } from "@/lib/analysis/scoring";
import type { RiskFlags } from "@/lib/analysis/types";
import type { TokenWithScores } from "@/lib/types";

export function analyzeContractRisk(token: TokenWithScores): RiskFlags {
  const liq = safe(token.liquidityUsd);
  const volatility = Math.abs(safe(token.priceChange1h)) + Math.abs(safe(token.priceChange5m));
  const lowLiquidity = liq < 75000;
  const hiddenTaxes = volatility > 70 && safe(token.volume24h) > liq * 5;
  const suspiciousPermissions = lowLiquidity && safe(token.priceChange5m) > 20;
  const failedSellSimulation = safe(token.txns5mSells) === 0 && safe(token.txns5mBuys) > 20;
  const HoneypotRiskScore = clamp((failedSellSimulation ? 34 : 8) + (hiddenTaxes ? 24 : 0) + (lowLiquidity ? 12 : 0));
  const RugRiskScore = clamp(HoneypotRiskScore + (suspiciousPermissions ? 20 : 0) + (token.ageHours !== null && token.ageHours < 2 ? 10 : 0));
  const ContractSafetyScore = clamp(100 - RugRiskScore * 0.82);

  return {
    mintable: false,
    pausable: false,
    blacklistable: suspiciousPermissions,
    proxyUpgradeable: false,
    maxWallet: false,
    maxTx: false,
    transferRestrictions: failedSellSimulation,
    ownerPrivileges: suspiciousPermissions,
    tradingCooldowns: token.ageHours !== null && token.ageHours < 1,
    hiddenTaxes,
    suspiciousPermissions,
    failedSellSimulation,
    dynamicTaxes: hiddenTaxes,
    abnormalGasBehavior: failedSellSimulation,
    ContractSafetyScore,
    RugRiskScore,
    HoneypotRiskScore,
    status: RugRiskScore > 65 ? "High-risk pattern detected" : RugRiskScore > 35 ? "Caution" : "No critical risk detected"
  };
}
