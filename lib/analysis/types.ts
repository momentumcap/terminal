import type { AlertSeverity } from "@/lib/types";
import type { ContractRiskProfile, DataQuality, DeployerProfile as OnchainDeployerProfile, HolderDistribution, OnchainTokenProfile, RecentTokenEvent } from "@/lib/onchain/types";
import type { SocialMomentumAnalysis } from "@/lib/social/types";
import type { DataQuality as TrustDataQuality, TrustedMetric, TrustedScore } from "@/lib/trust/types";

export type TrendClassification = "Launch Phase" | "Accumulation" | "Breakout" | "Expansion" | "Distribution" | "Exhaustion" | "Death Spiral";
export type WalletCategory = "Whale" | "Smart Money" | "Retail" | "Sniper" | "Insider" | "Market Maker" | "Fresh Wallet";
export type NarrativeCategory = "AI" | "meme" | "DeFi" | "Base ecosystem" | "gaming" | "SocialFi" | "infra" | "celebrity" | "political";
export type ContractSafetyStatus = "No critical risk detected" | "Caution" | "High-risk pattern detected" | "Risk unknown";
export type HolderGrowthStatus = "Accelerating" | "Stable" | "Stalling" | "Contracting" | "Unknown";

export interface AnalysisScores {
  MomentumScore: number;
  OpportunityScore: number;
  RiskScore: number;
  LiquidityHealthScore: number;
  SmartMoneyScore: number;
  HolderHealthScore: number;
  NarrativeStrengthScore: number;
  TradeabilityScore: number;
  RugRiskScore: number;
  ManipulationRiskScore: number;
}

export interface MomentumMetrics {
  priceMomentum: number;
  momentumConsistency: number;
  trendStrength: number;
  volatility: number;
  breakoutProbability: number;
  acceleration: number;
  volumeAcceleration: number;
  buyPressureRatio: number;
  trendConsistency: number;
  volatilityCompression: number;
  sustainedMomentumScore: number;
  priceSeries: Array<{ t: string; price: number }>;
  volumeSeries: Array<{ t: string; volume: number | null; buys: number | null; sells: number | null; source: "provider_raw" | "base_rpc" | "unavailable" }>;
  transactionWindows: Array<{ window: "5m" | "1h" | "6h" | "24h"; buys: number | null; sells: number | null; total: number | null; buyRatio: number | null; source: "BaseRPC" | "DexScreener" | "GeckoTerminal" | "Unavailable"; poolAddress?: string; complete?: boolean; fromBlock?: number; toBlock?: number; indexedLogCount?: number }>;
  providerTransactionWindows: Array<{ window: "5m" | "1h" | "6h" | "24h"; buys: number | null; sells: number | null; total: number | null; buyRatio: number | null; source: "DexScreener" | "GeckoTerminal" | "Unavailable" }>;
  onchainTransactionWindows: Array<{ window: "5m" | "1h" | "6h" | "24h"; buys: number | null; sells: number | null; total: number | null; buyRatio: number | null; source: "BaseRPC"; poolAddress: string; complete: boolean; fromBlock: number; toBlock: number; indexedLogCount: number }>;
  heatmap: Array<{ window: string; score: number }>;
}

export interface LiquidityMetrics {
  liquidityUsd: number;
  lpGrowth: number;
  liquidityConcentration: number;
  liquidityTrend: number;
  liquidityEfficiency: number;
  volumeLiquidityRatio: number;
  liquidityFragilityScore: number;
  suspiciousLpConcentration: boolean;
  suddenLpRemoval: boolean;
  liquiditySpike: boolean;
  slippageEstimates: Array<{ sizeUsd: number; estimatedSlippage: number; marketImpact: number }>;
}

export interface HolderMetrics {
  holderCount: number | null;
  holderCountIsEstimate?: boolean;
  sampledHolderCount?: number;
  holderCountGrowth: number;
  holderVelocity: number;
  whaleConcentration: number;
  top10Ownership: number;
  top25Ownership: number;
  top50Ownership?: number;
  deployerOwnership: number;
  lpOwnership?: number;
  contractOwnership?: number;
  burnOwnership?: number;
  retailOwnership?: number;
  holderDistributionQuality: number;
  holderHealthScore: number;
  concentrationRiskScore: number;
  source?: string;
  confidence?: "high" | "medium" | "low";
  warnings?: string[];
  actionableSignals?: string[];
  topHolders?: Array<{ address: string; label?: string; category?: string; ownershipPct?: number; balanceFormatted?: number; isContract?: boolean }>;
  walletIntelligence?: HolderWalletIntelligence;
  growthSeries: Array<{ t: string; holders: number }>;
  ownershipDistribution: Array<{ bucket: string; ownership: number }>;
}

export interface HolderWalletIntelligence {
  tokenAddress: string;
  indexedTransferCount: number;
  indexedWalletCount: number;
  activeWalletsRecent: number;
  netAccumulatorWallets: number;
  netDistributorWallets: number;
  largestObservedWallets: Array<{
    address: string;
    firstSeenBlock: number;
    lastSeenBlock: number;
    inCount: number;
    outCount: number;
    netRaw: string;
    direction: "accumulating" | "distributing" | "flat";
  }>;
  lastRun: {
    fromBlock: number;
    toBlock: number;
    transferCount: number;
    walletCount: number;
    status: string;
    warnings: string[];
    startedAt: string;
    finishedAt: string;
  } | null;
  warnings: string[];
}

export interface WalletProfile {
  address: string;
  label: string;
  category: WalletCategory;
  balanceUsd: number;
  pnlEstimate: number;
  firstSeen: string;
  lastAction: string;
  convictionScore: number;
  qualityScore: number;
  ethBalance?: number;
  tokenBalance?: number;
  tokenOwnershipPct?: number;
  txCount?: number;
  labels?: string[];
  riskFlags?: string[];
  recentActivity?: Array<{ txHash: string; timestamp?: string; type?: string; counterparty?: string }>;
  dataSource?: string;
  dataConfidence?: "high" | "medium" | "low";
}

export interface SmartMoneyMetrics {
  whaleBuys: number;
  whaleBuysIsEstimate: boolean;
  recurringAccumulators: number;
  profitableWalletParticipation: number;
  walletQualityScore: number;
  smartMoneyInflow: number;
  SmartMoneyScore: number;
  WhaleAccumulationScore: number;
  WalletConvictionScore: number;
  onchainWalletsAvailable: boolean;
  walletSignals: string[];
  largeTransferCount: number;
  deployerActivityDetected: boolean;
  wallets: WalletProfile[];
}

export interface WalletCluster {
  id: string;
  label: string;
  wallets: string[];
  sharedFundingSource: string | null;
  coordinatedTimingScore: number;
  deployerLinked: boolean;
  insiderProbabilityScore: number;
  sybilProbabilityScore: number;
  edges: Array<{ from: string; to: string; reason: string; strength: number }>;
}

export interface RiskFlags {
  mintable: boolean;
  pausable: boolean;
  blacklistable: boolean;
  proxyUpgradeable: boolean;
  maxWallet: boolean;
  maxTx: boolean;
  transferRestrictions: boolean;
  ownerPrivileges: boolean;
  tradingCooldowns: boolean;
  hiddenTaxes: boolean;
  suspiciousPermissions: boolean;
  failedSellSimulation: boolean;
  dynamicTaxes: boolean;
  abnormalGasBehavior: boolean;
  ContractSafetyScore: number;
  RugRiskScore: number;
  HoneypotRiskScore: number;
  status: ContractSafetyStatus;
}

export interface DeployerIntelligence {
  address: string;
  previousLaunches: number;
  previousRugs: number;
  priorSuccessfulTokens: number;
  walletAgeDays: number;
  fundingHistory: string;
  bridgeOrigins: string[];
  cexFunding: boolean;
  DeployerReputationScore: number;
}

export interface ManipulationMetrics {
  washTradingRisk: number;
  fakeVolumeRisk: number;
  coordinatedBuyRisk: number;
  spoofedActivityRisk: number;
  loopingLiquidityRisk: number;
  artificialHolderGrowthRisk: number;
  ManipulationRiskScore: number;
}

export interface NarrativeMetrics {
  category: NarrativeCategory;
  socialVelocity: number;
  mentionAcceleration: number;
  communityGrowth: number;
  narrativeMomentum: number;
  NarrativeStrengthScore: number;
  socialMomentum?: SocialMomentumAnalysis;
  signals: string[];
}

export interface TradeabilityMetrics {
  entryDifficulty: number;
  exitDifficulty: number;
  liquidityExhaustionRisk: number;
  TradeabilityScore: number;
  safeSizingUsd: number;
  simulations: Array<{ sizeUsd: number; estimatedSlippage: number; marketImpact: number; verdict: "safe" | "careful" | "avoid" }>;
}

export type BreakoutSetupStatus = "No setup" | "Early watch" | "Setup forming" | "High-conviction setup" | "Active breakout conditions";

export interface BreakoutWatchMetrics {
  probabilityScore: number;
  status: BreakoutSetupStatus;
  confidence: "high" | "medium" | "low";
  resistanceLevelUsd: number | null;
  supportLevelUsd: number | null;
  currentPriceUsd: number | null;
  distanceToResistancePct: number | null;
  volumeAccelerationScore: number;
  buyPressureTrendScore: number;
  priceCompressionScore: number;
  resistanceRetestScore: number;
  liquiditySupportScore: number;
  holderExpansionScore: number;
  smartWalletInflowScore: number;
  socialMomentumScore: number;
  riskPenaltyScore: number;
  boosts: string[];
  penalties: string[];
  confirmationTriggers: string[];
  invalidationTriggers: string[];
  confirmedFacts: string[];
  inferredSignals: string[];
  missingData: string[];
  explanation: string;
  updatedAt: string;
}

export interface TacticalSummary {
  stance: "BULLISH STRUCTURE" | "TACTICAL NEUTRAL" | "DISTRIBUTION RISK" | "HIGH RISK";
  confidence: number;
  confirmedFacts: string[];
  inferredSignals: string[];
  bullish: string[];
  risks: string[];
  missingData: string[];
  tacticalView: string;
}

export interface AlertEvent {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  metrics: Record<string, number | string | boolean | null>;
}

export interface OwnDataSummary {
  source: "BaseRPC";
  updatedAt: string;
  tokenMetadata: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    totalSupply: string | null;
  };
  primaryPool: {
    protocol: "uniswap_v3" | "uniswap_v2";
    address: string;
    quoteToken: "USDC" | "WETH" | "OTHER";
    quoteAddress: string;
    fee?: number;
  } | null;
  poolCount: number;
  transactionWindowsAvailable: boolean;
  transferSummary: {
    transferCount: number;
    uniqueSenders: number;
    uniqueReceivers: number;
  } | null;
}

export interface MarketDataSummary {
  primaryMarketSource: "DexScreener" | "GeckoTerminal" | "Mock";
  marketDataSources: Array<"DexScreener" | "GeckoTerminal" | "BaseRPC" | "Mock">;
  pairAddress: string;
  dexId: string;
  sourcePolicy: string;
}

export interface TokenAnalysis {
  chainId: 8453;
  address: string;
  symbol: string;
  name: string;
  updatedAt: string;
  source: "public-api" | "mock-fallback" | "hybrid";
  dataQuality?: TrustDataQuality;
  trustedScores?: Record<string, TrustedScore>;
  trustedMetrics?: Record<string, TrustedMetric<unknown>>;
  executiveSummary: {
    opportunityScore: number;
    riskScore: number;
    momentumScore: number;
    liquidityHealthScore: number;
    smartMoneyActivity: string;
    holderGrowthStatus: HolderGrowthStatus;
    contractSafetyStatus: ContractSafetyStatus;
    currentTrendClassification: TrendClassification;
  };
  scores: AnalysisScores;
  tacticalSummary: TacticalSummary;
  momentum: MomentumMetrics;
  liquidity: LiquidityMetrics;
  holders: HolderMetrics;
  smartMoney: SmartMoneyMetrics;
  clusters: WalletCluster[];
  risk: RiskFlags;
  deployer: DeployerIntelligence;
  manipulation: ManipulationMetrics;
  narrative: NarrativeMetrics;
  tradeability: TradeabilityMetrics;
  breakoutWatch: BreakoutWatchMetrics;
  liveEvents: AlertEvent[];
  ownData?: OwnDataSummary;
  marketData: MarketDataSummary;
  onchain?: {
    profile?: OnchainTokenProfile;
    holders?: HolderDistribution;
    contractRisk?: ContractRiskProfile;
    deployer?: OnchainDeployerProfile;
    events?: RecentTokenEvent[];
    dataQuality: DataQuality;
  };
  adapters: Record<string, "placeholder" | "public-api" | "unavailable">;
}
