import type { TokenAnalysis } from "@/lib/analysis/types";

type MergeableAnalysis = TokenAnalysis;
type OnchainAnalysis = NonNullable<TokenAnalysis["onchain"]>;

export function mergeAnalysisWithLastKnownGood(current: MergeableAnalysis, previous: TokenAnalysis | null): MergeableAnalysis {
  if (!previous || previous.address.toLowerCase() !== current.address.toLowerCase()) return current;

  const fills: string[] = [];
  const analysis: MergeableAnalysis = structuredCloneCompat(current);

  analysis.onchain = analysis.onchain ?? previous.onchain;
  if (analysis.onchain && previous.onchain) {
    analysis.onchain.profile = mergeProfile(analysis.onchain.profile, previous.onchain.profile, fills);
    analysis.onchain.holders = analysis.onchain.holders ?? fill("holder distribution", previous.onchain.holders, fills);
    analysis.onchain.contractRisk = analysis.onchain.contractRisk ?? fill("contract risk", previous.onchain.contractRisk, fills);
    analysis.onchain.deployer = mergeDeployer(analysis.onchain.deployer, previous.onchain.deployer, fills);
    analysis.onchain.events = analysis.onchain.events?.length ? analysis.onchain.events : fill("recent events", previous.onchain.events, fills);
  }

  analysis.ownData = analysis.ownData?.transactionWindowsAvailable ? analysis.ownData : fill("Base RPC swap windows", previous.ownData, fills);
  if (!analysis.momentum.onchainTransactionWindows.length && previous.momentum.onchainTransactionWindows.length) {
    analysis.momentum.onchainTransactionWindows = previous.momentum.onchainTransactionWindows;
    analysis.momentum.transactionWindows = previous.momentum.onchainTransactionWindows;
    analysis.momentum.volumeSeries = previous.momentum.volumeSeries.length ? previous.momentum.volumeSeries : analysis.momentum.volumeSeries;
    fills.push("onchain buy/sell windows");
  }

  if ((!analysis.holders.holderCount && !analysis.holders.topHolders?.length) && (previous.holders.holderCount || previous.holders.topHolders?.length)) {
    analysis.holders = previous.holders;
    fills.push("holder analysis");
  }

  if (!analysis.smartMoney.wallets.length && previous.smartMoney.wallets.length) {
    analysis.smartMoney = previous.smartMoney;
    fills.push("wallet intelligence");
  }

  if (!analysis.deployer.address && previous.deployer.address) {
    analysis.deployer = previous.deployer;
    fills.push("deployer intelligence");
  }

  if (fills.length) {
    const uniqueFills = [...new Set(fills)];
    analysis.dataQuality = analysis.dataQuality ?? current.dataQuality;
    if (analysis.dataQuality) {
      analysis.dataQuality.disagreementWarnings = [
        ...new Set([
          ...(analysis.dataQuality.disagreementWarnings ?? []),
          `Filled ${uniqueFills.join(", ")} from last-known-good snapshot because live providers returned partial data.`
        ])
      ];
      analysis.dataQuality.sourcesUsed = [...new Set([...(analysis.dataQuality.sourcesUsed ?? []), "last-known-good sqlite snapshot"])];
      analysis.dataQuality.confidence = analysis.dataQuality.confidence === "high" ? "medium" : analysis.dataQuality.confidence;
    }
    if (analysis.onchain?.dataQuality) {
      analysis.onchain.dataQuality.warnings = [
        ...new Set([
          ...analysis.onchain.dataQuality.warnings,
          `Some onchain sections were filled from a previous successful snapshot: ${uniqueFills.join(", ")}.`
        ])
      ];
      analysis.onchain.dataQuality.confidence = analysis.onchain.dataQuality.confidence === "high" ? "medium" : analysis.onchain.dataQuality.confidence;
      analysis.onchain.dataQuality.isPartial = true;
    }
  }

  return analysis;
}

function mergeProfile(current: OnchainAnalysis["profile"] | undefined, previous: OnchainAnalysis["profile"] | undefined, fills: string[]) {
  if (!current) return fill("onchain metadata", previous, fills);
  if (!previous) return current;
  const merged = {
    ...current,
    name: current.name ?? previous.name,
    symbol: current.symbol ?? previous.symbol,
    decimals: current.decimals ?? previous.decimals,
    totalSupply: current.totalSupply ?? previous.totalSupply,
    owner: current.owner ?? previous.owner,
    deployer: current.deployer ?? previous.deployer,
    createdAt: current.createdAt ?? previous.createdAt,
    creationTxHash: current.creationTxHash ?? previous.creationTxHash,
    verified: current.verified ?? previous.verified,
    holdersCount: current.holdersCount ?? previous.holdersCount,
    transferCount24h: current.transferCount24h ?? previous.transferCount24h
  };
  if (JSON.stringify(merged) !== JSON.stringify(current)) fills.push("onchain metadata");
  return merged;
}

function mergeDeployer(current: OnchainAnalysis["deployer"] | undefined, previous: OnchainAnalysis["deployer"] | undefined, fills: string[]) {
  if (!current) return fill("deployer profile", previous, fills);
  if (!previous || current.deployer) return current;
  fills.push("deployer profile");
  return {
    ...current,
    deployer: previous.deployer,
    creationTxHash: current.creationTxHash ?? previous.creationTxHash,
    createdAt: current.createdAt ?? previous.createdAt,
    deployerEthBalance: current.deployerEthBalance ?? previous.deployerEthBalance,
    priorLaunches: current.priorLaunches?.length ? current.priorLaunches : previous.priorLaunches,
    reputationScore: current.reputationScore === 50 ? previous.reputationScore : current.reputationScore
  };
}

function fill<T>(label: string, value: T | undefined, fills: string[]): T | undefined {
  if (value === undefined || value === null) return undefined;
  fills.push(label);
  return value;
}

function structuredCloneCompat<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
