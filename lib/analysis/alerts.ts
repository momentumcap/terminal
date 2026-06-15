import type { AlertEvent, TokenAnalysis } from "@/lib/analysis/types";

export function buildAnalysisAlerts(analysis: Omit<TokenAnalysis, "liveEvents" | "tacticalSummary">): AlertEvent[] {
  const now = new Date().toISOString();
  const events: AlertEvent[] = [];
  const push = (type: string, severity: AlertEvent["severity"], message: string, metrics: AlertEvent["metrics"]) => {
    events.push({ id: `${type}-${analysis.address}`, type, severity, message, createdAt: now, metrics });
  };

  if (analysis.breakoutWatch.probabilityScore > 70) {
    push("breakout_watch", "info", `${analysis.symbol} pre-breakout setup requires monitoring`, {
      breakoutProbability: analysis.breakoutWatch.probabilityScore,
      confidence: analysis.breakoutWatch.confidence,
      status: analysis.breakoutWatch.status
    });
  }
  if (analysis.smartMoney.smartMoneyInflow > 68) push("smart_money_entry", "info", `${analysis.symbol} likely smart-money inflow pattern detected`, { smartMoneyInflow: analysis.smartMoney.smartMoneyInflow });
  if (analysis.liquidity.suddenLpRemoval) push("liquidity_change", "critical", `${analysis.symbol} possible sudden LP removal`, { liquidityFragilityScore: analysis.liquidity.liquidityFragilityScore });
  if (analysis.holders.holderVelocity > 70) push("holder_spike", "info", `${analysis.symbol} holder velocity accelerating`, { holderVelocity: analysis.holders.holderVelocity });
  if (analysis.risk.RugRiskScore > 60) push("risk_alert", "critical", `${analysis.symbol} contract/rug risk is elevated`, { rugRisk: analysis.risk.RugRiskScore });
  if (analysis.manipulation.ManipulationRiskScore > 55) push("risk_alert", "warning", `${analysis.symbol} manipulation risk requires caution`, { manipulationRisk: analysis.manipulation.ManipulationRiskScore });
  if (analysis.momentum.volumeAcceleration > 72) push("volume_spike", "warning", `${analysis.symbol} volume acceleration is above baseline`, { volumeAcceleration: analysis.momentum.volumeAcceleration });
  if (analysis.smartMoney.whaleBuys > 5) push("whale_buy", "info", `${analysis.symbol} whale buy cluster detected`, { whaleBuys: analysis.smartMoney.whaleBuys });

  return events;
}
