import type { BankrAlert, BankrLaunch } from "@/types/bankr";

export function buildBankrAlerts(launches: BankrLaunch[]): BankrAlert[] {
  const now = new Date().toISOString();
  const alerts: BankrAlert[] = [];
  const add = (launch: BankrLaunch, type: string, severity: BankrAlert["severity"], message: string, metrics: BankrAlert["metrics"]) => {
    alerts.push({ id: `${type}-${launch.tokenAddress}`, tokenAddress: launch.tokenAddress, tokenSymbol: launch.tokenSymbol, type, severity, message, createdAt: now, metrics });
  };

  for (const launch of launches) {
    if (launch.verdict === "verified_alpha") add(launch, "verified_alpha", "alpha", `${launch.tokenSymbol} passed creator, liquidity, market, and risk gates`, { credibilityScore: launch.credibilityScore, liquidityUsd: launch.liquidityUsd });
    if (launch.verdict === "blocked") add(launch, "blocked_launch", "danger", `${launch.tokenSymbol} blocked by defensive launch scanner`, { reason: launch.verdictReason });
    if (launch.flags.some((flag) => flag.type === "known_builder")) add(launch, "allowlisted_launch", "alpha", `${launch.tokenSymbol} launched by allowlisted creator ${launch.creatorHandle ?? "unknown"}`, { credibilityScore: launch.credibilityScore });
    if (launch.credibilityScore >= 80) add(launch, "high_credibility_launch", "alpha", `${launch.tokenSymbol} has high creator credibility`, { credibilityScore: launch.credibilityScore });
    if ((launch.liquidityUsd ?? 0) >= 50000) add(launch, "liquidity_threshold", "info", `${launch.tokenSymbol} crossed liquidity threshold`, { liquidityUsd: launch.liquidityUsd });
    if ((launch.volume5m ?? 0) >= 10000 || (launch.volume1h ?? 0) >= 50000) add(launch, "volume_threshold", "warning", `${launch.tokenSymbol} crossed early volume threshold`, { volume5m: launch.volume5m, volume1h: launch.volume1h });
    if (launch.flags.some((flag) => flag.type === "buy_pressure")) add(launch, "buy_pressure_spike", "alpha", `${launch.tokenSymbol} showing early buy pressure`, { buys5m: launch.buys5m, sells5m: launch.sells5m });
    if (launch.fdv && launch.liquidityUsd && launch.fdv / Math.max(launch.liquidityUsd, 1) > 120) add(launch, "fdv_spike", "warning", `${launch.tokenSymbol} FDV/liquidity mismatch is extreme`, { fdv: launch.fdv, liquidityUsd: launch.liquidityUsd });
    if (launch.flags.some((flag) => flag.severity === "danger")) add(launch, "risk_flag_detected", "danger", `${launch.tokenSymbol} has defensive risk flags`, { riskScore: launch.riskScore });
    if (launch.flags.some((flag) => flag.type === "symbol_collision")) add(launch, "duplicate_symbol", "warning", `${launch.tokenSymbol} symbol collision detected`, { symbol: launch.tokenSymbol });
  }

  return alerts.slice(0, 50);
}
