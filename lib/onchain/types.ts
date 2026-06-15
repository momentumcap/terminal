export type DataConfidence = "high" | "medium" | "low";

export interface DataQuality {
  source: string;
  sourcesTried: string[];
  confidence: DataConfidence;
  isPartial: boolean;
  missingFields: string[];
  warnings: string[];
  fetchedAt: string;
}

export interface TokenTransfer {
  txHash: string;
  logIndex?: number;
  blockNumber: number;
  from: string;
  to: string;
  valueRaw: string;
  timestamp?: string;
}

export interface OnchainTokenProfile {
  chainId: 8453;
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  owner?: string;
  deployer?: string;
  createdAt?: string;
  creationTxHash?: string;
  verified?: boolean;
  isProxy?: boolean;
  implementationAddress?: string;
  holdersCount?: number;
  transferCount24h?: number;
  dataQuality: DataQuality;
}

export interface TokenHolder {
  address: string;
  balanceRaw: string;
  balanceFormatted?: number;
  ownershipPct?: number;
  isContract?: boolean;
  label?: string;
  category?: "deployer" | "lp" | "cex" | "contract" | "burn" | "whale" | "retail" | "unknown";
}

export interface HolderDistribution {
  tokenAddress: string;
  holders: TokenHolder[];
  totalHolders?: number;
  sampledHolderCount?: number;
  top10Pct?: number;
  top25Pct?: number;
  top50Pct?: number;
  whalePct?: number;
  lpPct?: number;
  contractPct?: number;
  burnPct?: number;
  retailPct?: number;
  deployerPct?: number;
  topHolder?: TokenHolder;
  actionableSignals: string[];
  concentrationRisk: number;
  dataQuality: DataQuality;
}

export interface WalletActivity {
  txHash: string;
  timestamp?: string;
  direction?: "in" | "out" | "self" | "unknown";
  counterparty?: string;
  valueEth?: number;
  type?: string;
}

export interface WalletProfile {
  address: string;
  firstSeen?: string;
  ethBalance?: number;
  tokenBalances?: unknown[];
  txCount?: number;
  labels: string[];
  category?: string;
  knownEntity?: string;
  recentActivity?: WalletActivity[];
  riskFlags: string[];
  dataQuality: DataQuality;
}

export interface LiquidityEvent {
  txHash: string;
  timestamp?: string;
  poolAddress?: string;
  dex?: string;
  tokenAddress: string;
  type: "add" | "remove" | "swap" | "unknown";
  amountUsd?: number;
  wallet?: string;
}

export interface RiskFlag {
  type: string;
  severity: "info" | "warning" | "danger";
  message: string;
  evidence?: string;
}

export interface ContractRiskProfile {
  tokenAddress: string;
  verified?: boolean;
  owner?: string;
  isProxy?: boolean;
  canMint?: boolean;
  canPause?: boolean;
  canBlacklist?: boolean;
  hasTransferTax?: boolean;
  maxTx?: boolean;
  maxWallet?: boolean;
  suspiciousFunctions: string[];
  riskFlags: RiskFlag[];
  contractSafetyScore: number;
  dataQuality: DataQuality;
}

export interface DeployerProfile {
  tokenAddress: string;
  deployer?: string;
  creationTxHash?: string;
  createdAt?: string;
  deployerEthBalance?: number;
  priorLaunches?: unknown[];
  suspiciousHistory?: boolean;
  reputationScore: number;
  dataQuality: DataQuality;
}

export interface RecentTokenEvent {
  id: string;
  tokenAddress: string;
  type: "transfer" | "large_transfer" | "lp_add" | "lp_remove" | "swap" | "owner_action" | "contract_verified" | "deployer_movement";
  severity: "info" | "alpha" | "warning" | "danger";
  message: string;
  txHash?: string;
  wallet?: string;
  amountUsd?: number;
  timestamp: string;
  source: string;
}

export interface TradeabilityProfile {
  tokenAddress: string;
  liquidityUsd?: number;
  safeSizingUsd?: number;
  warnings: string[];
  dataQuality: DataQuality;
}

export interface OnchainResponse<T> {
  data: T;
  dataQuality: DataQuality;
}

export interface TransferQueryOptions {
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
}

export interface HolderQueryOptions {
  limit?: number;
  mode?: "auto" | "indexer" | "rpc";
  fromBlock?: number;
  toBlock?: number;
}
