import { enrichToken } from "@/lib/scoring";
import type { Alert, TokenSnapshot, TokenWithScores } from "@/lib/types";

const idFor = (token: TokenSnapshot, type: Alert["type"]) => `${type}-${token.tokenAddress}-${token.pairAddress}`;

function alert(token: TokenSnapshot, type: Alert["type"], severity: Alert["severity"], message: string, metrics: Alert["metrics"]): Alert {
  return {
    id: idFor(token, type),
    tokenAddress: token.tokenAddress,
    symbol: token.symbol,
    type,
    severity,
    message,
    createdAt: new Date().toISOString(),
    metrics
  };
}

export function generateAlerts(tokens: TokenSnapshot[]): Alert[] {
  const enriched = tokens.map(enrichToken);
  return enriched.flatMap((token) => buildTokenAlerts(token)).slice(0, 40);
}

function buildTokenAlerts(token: TokenWithScores): Alert[] {
  const alerts: Alert[] = [];
  const volumeSpike = token.volume1h && token.volume24h ? token.volume1h / Math.max(token.volume24h / 24, 1) : 0;
  const buyPressure = token.buySellImbalance ?? 0;
  const liquidity = token.liquidityUsd ?? 0;

  if (volumeSpike > 2.8) {
    alerts.push(alert(token, "volume_spike", "warning", `${token.symbol} volume pacing ${volumeSpike.toFixed(1)}x above 24h baseline`, { volumeSpike }));
  }
  if (buyPressure > 0.32 && (token.txns5mBuys ?? 0) > 20) {
    alerts.push(alert(token, "buy_pressure_spike", "info", `${token.symbol} buyers control recent flow`, { buyPressure }));
  }
  if ((token.liquidityToVolumeRatio ?? 1) < 0.08 && (token.volume24h ?? 0) > 100000) {
    alerts.push(alert(token, "liquidity_drop", "warning", `${token.symbol} liquidity looks thin relative to traded volume`, { liquidityToVolumeRatio: token.liquidityToVolumeRatio }));
  }
  if (token.ageHours !== null && token.ageHours < 1.5) {
    alerts.push(alert(token, "new_pool_detected", "info", `${token.symbol} new Base pool detected`, { ageHours: token.ageHours }));
  }
  if ((token.priceChange1h ?? 0) > 10 && (token.priceChange5m ?? 0) > 2) {
    alerts.push(alert(token, "price_breakout", "info", `${token.symbol} price breakout across 5m and 1h windows`, { priceChange5m: token.priceChange5m, priceChange1h: token.priceChange1h }));
  }
  if (token.scores.riskScore < 45 || liquidity < 50000) {
    alerts.push(alert(token, "high_risk_low_liquidity", "critical", `${token.symbol} high-risk profile: low liquidity or extreme volatility`, { riskScore: token.scores.riskScore, liquidity }));
  }
  if (token.ageHours !== null && token.ageHours < 24 && token.scores.opportunityScore > 68) {
    alerts.push(alert(token, "trending_newly_detected", "warning", `${token.symbol} fresh pool entering opportunity band`, { opportunityScore: token.scores.opportunityScore, ageHours: token.ageHours }));
  }

  return alerts;
}
