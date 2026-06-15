import { credibleAccountsConfig } from "@/config/credibleAccounts";
import type { BankrCreatorTier, BankrLaunch, BankrLaunchFlag, BankrLaunchVerdict } from "@/types/bankr";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const handleKey = (handle?: string) => (handle ?? "").replace(/^@/, "").toLowerCase();
const ageDays = (iso?: string) => (iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / 864e5) : null);

export function scoreBankrLaunchCredibility(launch: Partial<BankrLaunch>): number {
  const handle = handleKey(launch.creatorHandle);
  const followers = launch.creatorFollowers ?? 0;
  const accountAge = ageDays(launch.creatorCreatedAt);
  const profileText = `${launch.creatorName ?? ""} ${launch.launchText ?? ""}`.toLowerCase();

  // CredibilityScore formula:
  // Start neutral at 35. Add verified status, log-scaled followers, account age,
  // manual allowlist/weighted handles, prior-performance placeholders, and builder keywords.
  // Subtract denylist and suspicious-keyword penalties. This is an attention-quality signal,
  // never a safety guarantee.
  let score = 35;
  if (launch.creatorVerified) score += 16;
  score += clamp(Math.log10(Math.max(followers, 1)) * 8, 0, 32);
  if (accountAge !== null) score += accountAge > 365 ? 10 : accountAge > 90 ? 5 : accountAge < 21 ? -8 : 0;
  if (credibleAccountsConfig.allowlistedHandles.includes(handle)) score += 18;
  if (credibleAccountsConfig.denylistedHandles.includes(handle)) score -= 35;
  score += credibleAccountsConfig.weightedHandles[handle] ?? 0;
  score += credibleAccountsConfig.builderKeywords.some((keyword) => profileText.includes(keyword)) ? 7 : 0;
  score -= credibleAccountsConfig.suspiciousKeywords.some((keyword) => profileText.includes(keyword)) ? 20 : 0;
  return Math.round(clamp(score));
}

export function classifyBankrCreatorTier(handle?: string): BankrCreatorTier {
  const key = handleKey(handle);
  if (credibleAccountsConfig.denylistedHandles.includes(key)) return "deny";
  if (credibleAccountsConfig.tier1Handles.includes(key)) return "tier1";
  if (credibleAccountsConfig.tier2Handles.includes(key)) return "tier2";
  if (credibleAccountsConfig.watchHandles.includes(key) || credibleAccountsConfig.allowlistedHandles.includes(key)) return "watch";
  return "unknown";
}

export function detectBankrLaunchRisks(launch: BankrLaunch, knownSymbols: Set<string>): BankrLaunchFlag[] {
  const flags: BankrLaunchFlag[] = [];
  const handle = handleKey(launch.creatorHandle);
  const text = `${launch.tokenName} ${launch.tokenSymbol} ${launch.creatorName ?? ""} ${launch.launchText ?? ""}`.toLowerCase();
  const buys = launch.buys5m ?? 0;
  const sells = launch.sells5m ?? 0;

  if (launch.credibilityScore >= 75) flags.push({ type: "credible_creator", severity: "alpha", message: "Credible creator launch" });
  if (launch.creatorVerified) flags.push({ type: "verified_creator", severity: "info", message: "Creator appears verified" });
  if ((launch.creatorFollowers ?? 0) > 50000) flags.push({ type: "high_follower_creator", severity: "alpha", message: "High-follower creator" });
  if (credibleAccountsConfig.allowlistedHandles.includes(handle)) flags.push({ type: "known_builder", severity: "alpha", message: "Handle is in editable credible account config" });
  if (launch.ageMinutes < 30) flags.push({ type: "fresh_launch", severity: "info", message: "Fresh launch under 30 minutes old" });
  if (!launch.liquidityUsd) flags.push({ type: "liquidity_missing", severity: "danger", message: "No usable liquidity data yet" });
  if ((launch.liquidityUsd ?? 0) > 0 && (launch.liquidityUsd ?? 0) < 25000) flags.push({ type: "low_liquidity", severity: "warning", message: "Liquidity is thin for active trading" });
  if (credibleAccountsConfig.suspiciousKeywords.some((keyword) => text.includes(keyword))) flags.push({ type: "suspicious_metadata", severity: "danger", message: "Launch metadata contains suspicious terms" });
  if (knownSymbols.has(launch.tokenSymbol.toLowerCase())) flags.push({ type: "symbol_collision", severity: "warning", message: "Symbol collides with another recent Bankr launch" });
  if (credibleAccountsConfig.denylistedHandles.includes(handle) || text.includes("official") || text.includes("support")) flags.push({ type: "creator_impersonation_risk", severity: "danger", message: "Creator or text resembles support/official impersonation pattern" });
  if (credibleAccountsConfig.denylistedHandles.includes(handle)) flags.push({ type: "creator_denylisted", severity: "danger", message: "Creator is in denylist" });
  if ((launch.volume5m ?? 0) > Math.max((launch.volume1h ?? 0) * 0.45, 5000)) flags.push({ type: "rapid_volume_spike", severity: "alpha", message: "Rapid early volume spike" });
  if (buys + sells > 0 && buys / Math.max(buys + sells, 1) > 0.68) flags.push({ type: "buy_pressure", severity: "alpha", message: "Strong early buy pressure" });
  if (launch.credibilityScore > 80) flags.push({ type: "creator_previous_success", severity: "info", message: "Prior success placeholder positive via credibility config" });
  if (credibleAccountsConfig.denylistedHandles.includes(handle)) flags.push({ type: "creator_previous_rug", severity: "danger", message: "Creator denylist hit" });
  if (!launch.dexPairAddress) flags.push({ type: "sellability_unknown", severity: "warning", message: "Sellability not verified yet" });
  if (launch.dexPairAddress) flags.push({ type: "cleared_market_data", severity: "info", message: "Market data detected" });
  if ((launch.liquidityUsd ?? 0) >= 50000) flags.push({ type: "cleared_liquidity", severity: "info", message: "Liquidity cleared threshold" });
  return flags;
}

export function scoreBankrLaunchQuality(launch: BankrLaunch): number {
  const buyPressure = (launch.buys5m ?? 0) + (launch.sells5m ?? 0) ? (launch.buys5m ?? 0) / ((launch.buys5m ?? 0) + (launch.sells5m ?? 0)) : 0.5;
  const volumeAcceleration = launch.volume1h ? ((launch.volume5m ?? 0) * 12) / launch.volume1h : 0;
  const liquidityDepth = clamp(Math.log10(Math.max(launch.liquidityUsd ?? 0, 1)) * 15 - 35);
  return Math.round(clamp(launch.credibilityScore * 0.24 + liquidityDepth * 0.28 + clamp(volumeAcceleration * 45) * 0.18 + buyPressure * 100 * 0.18 + (launch.ageMinutes < 60 ? 12 : 4)));
}

export function scoreBankrRisk(launch: BankrLaunch): number {
  const liquidityPenalty = !launch.liquidityUsd ? 38 : launch.liquidityUsd < 10000 ? 30 : launch.liquidityUsd < 50000 ? 16 : 4;
  const fdvLiqPenalty = launch.fdv && launch.liquidityUsd ? clamp((launch.fdv / Math.max(launch.liquidityUsd, 1) - 60) * 0.4, 0, 22) : 8;
  const dangerFlags = launch.flags.filter((flag) => flag.severity === "danger").length * 14;
  const unverifiedPenalty = launch.creatorVerified ? 0 : 8;
  return Math.round(clamp(100 - liquidityPenalty - fdvLiqPenalty - dangerFlags - unverifiedPenalty));
}

export function scoreBankrOpportunity(launch: BankrLaunch): number {
  const alphaFlags = launch.flags.filter((flag) => flag.severity === "alpha").length;
  const volumeScore = clamp(Math.log10(Math.max(launch.volume5m ?? launch.volume1h ?? 0, 1)) * 16);
  const freshness = launch.ageMinutes < 15 ? 88 : launch.ageMinutes < 60 ? 76 : launch.ageMinutes < 240 ? 58 : 32;
  return Math.round(clamp(launch.launchQualityScore * 0.34 + launch.credibilityScore * 0.2 + launch.riskScore * 0.18 + volumeScore * 0.14 + freshness * 0.1 + alphaFlags * 3));
}

export function classifyBankrVerdict(launch: BankrLaunch): { verdict: BankrLaunchVerdict; verdictReason: string; gateChecks: BankrLaunch["gateChecks"] } {
  const dangerFlags = launch.flags.filter((flag) => flag.severity === "danger");
  const hasImpersonation = launch.flags.some((flag) => flag.type === "creator_impersonation_risk" || flag.type === "creator_denylisted");
  const gateChecks = {
    creatorCleared: launch.creatorTier === "tier1" || launch.creatorTier === "tier2" || launch.credibilityScore >= 70,
    marketDataReady: Boolean(launch.dexPairAddress),
    liquidityCleared: (launch.liquidityUsd ?? 0) >= 25000,
    sellabilityCleared: Boolean(launch.dexPairAddress) && (launch.sells5m ?? 0) > 0,
    contractCleared: !launch.flags.some((flag) => flag.type === "suspicious_metadata" || flag.type === "creator_impersonation_risk"),
    deployerCleared: launch.creatorTier !== "deny"
  };

  if (launch.creatorTier === "deny" || hasImpersonation || dangerFlags.length >= 2) {
    return { verdict: "blocked", verdictReason: "Blocked by denylist, impersonation, or multiple danger flags.", gateChecks };
  }
  if (gateChecks.creatorCleared && gateChecks.marketDataReady && gateChecks.liquidityCleared && gateChecks.contractCleared && launch.riskScore >= 70) {
    return { verdict: "verified_alpha", verdictReason: "Credible creator plus market/liquidity/risk gates cleared. Still verify sellability before trading.", gateChecks };
  }
  if (gateChecks.creatorCleared || launch.credibilityScore >= 55 || launch.opportunityScore >= 55) {
    return { verdict: "watch", verdictReason: "Credible or interesting launch, but one or more defensive gates are still pending.", gateChecks };
  }
  return { verdict: "speculative", verdictReason: "Fresh launch with incomplete creator, liquidity, or sellability evidence.", gateChecks };
}
