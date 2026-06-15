export type BankrLaunchFlagType =
  | "credible_creator"
  | "verified_creator"
  | "high_follower_creator"
  | "known_builder"
  | "fresh_launch"
  | "liquidity_missing"
  | "low_liquidity"
  | "suspicious_metadata"
  | "symbol_collision"
  | "creator_impersonation_risk"
  | "rapid_volume_spike"
  | "buy_pressure"
  | "creator_previous_success"
  | "creator_previous_rug"
  | "sellability_unknown"
  | "contract_unverified"
  | "fresh_deployer"
  | "creator_denylisted"
  | "cleared_liquidity"
  | "cleared_market_data";

export type BankrCreatorTier = "tier1" | "tier2" | "watch" | "unknown" | "deny";
export type BankrLaunchVerdict = "verified_alpha" | "watch" | "speculative" | "blocked";

export interface BankrLaunchFlag {
  type: BankrLaunchFlagType;
  severity: "info" | "warning" | "danger" | "alpha";
  message: string;
}

export interface BankrLaunch {
  id: string;
  chainId: 8453;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  creatorHandle?: string;
  creatorName?: string;
  creatorProfileUrl?: string;
  creatorFollowers?: number;
  creatorVerified?: boolean;
  creatorCreatedAt?: string;
  launchPostUrl?: string;
  launchText?: string;
  launchedAt: string;
  ageMinutes: number;
  dexPairAddress?: string;
  priceUsd?: number;
  liquidityUsd?: number;
  fdv?: number;
  marketCap?: number;
  volume5m?: number;
  volume1h?: number;
  volume24h?: number;
  buys5m?: number;
  sells5m?: number;
  holdersEstimate?: number;
  deployerReputationScore?: number;
  contractSafetyScore?: number;
  concentrationRisk?: number;
  onchainConfidence?: "high" | "medium" | "low";
  creatorTier: BankrCreatorTier;
  verdict: BankrLaunchVerdict;
  verdictReason: string;
  gateChecks: {
    creatorCleared: boolean;
    marketDataReady: boolean;
    liquidityCleared: boolean;
    sellabilityCleared: boolean;
    contractCleared: boolean;
    deployerCleared: boolean;
  };
  credibilityScore: number;
  launchQualityScore: number;
  riskScore: number;
  opportunityScore: number;
  dataQuality?: DataQuality;
  flags: BankrLaunchFlag[];
}

export interface BankrAlert {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  type: string;
  severity: "info" | "warning" | "danger" | "alpha";
  message: string;
  createdAt: string;
  metrics: Record<string, number | string | boolean | null | undefined>;
}

export interface BankrFiltersState {
  query: string;
  minLiquidity: number;
  maxAgeMinutes: number;
  minCredibility: number;
  riskLevel: "all" | "low" | "medium" | "high";
  verdict: "all" | BankrLaunchVerdict | "cleared";
}
import type { DataQuality } from "@/lib/trust/types";
