export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_SLUG = "base";

export type RiskLevel = "low" | "medium" | "high";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "volume_spike"
  | "buy_pressure_spike"
  | "liquidity_drop"
  | "new_pool_detected"
  | "price_breakout"
  | "high_risk_low_liquidity"
  | "trending_newly_detected";

export interface TokenSnapshot {
  chainId: number;
  tokenAddress: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  fdv: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  volume5m: number | null;
  volume1h: number | null;
  volume6h: number | null;
  volume24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  txns5mBuys: number | null;
  txns5mSells: number | null;
  txns1hBuys: number | null;
  txns1hSells: number | null;
  txns6hBuys: number | null;
  txns6hSells: number | null;
  txns24hBuys: number | null;
  txns24hSells: number | null;
  pairAddress: string;
  dexId: string;
  quoteTokenAddress?: string;
  quoteTokenSymbol?: string;
  pairCreatedAt: number | null;
  url: string;
  updatedAt: string;
  primaryMarketSource?: "DexScreener" | "GeckoTerminal" | "Mock";
  marketDataSources?: Array<"DexScreener" | "GeckoTerminal" | "BaseRPC" | "Mock">;
}

export interface TokenScores {
  momentumScore: number;
  liquidityHealthScore: number;
  flowScore: number;
  riskScore: number;
  opportunityScore: number;
}

export interface TokenWithScores extends TokenSnapshot {
  scores: TokenScores;
  riskLevel: RiskLevel;
  ageHours: number | null;
  buySellImbalance: number | null;
  liquidityToVolumeRatio: number | null;
  volumeToLiquidityRatio: number | null;
  sparkline: number[];
}

export interface Alert {
  id: string;
  tokenAddress: string;
  symbol: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  metrics: Record<string, number | string | null>;
}

export interface DiscoveryFiltersState {
  minLiquidity: number;
  minVolume: number;
  maxAgeHours: number;
  riskLevel: "all" | RiskLevel;
}

export interface WatchlistEntry {
  tokenAddress: string;
  symbol: string;
  createdAt: string;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
