import { buildAnalysisAlerts } from "@/lib/analysis/alerts";
import { analysisAdapters } from "@/lib/analysis/adapters";
import { mergeAnalysisWithLastKnownGood } from "@/lib/analysis/availability";
import { analyzeBreakoutWatch } from "@/lib/analysis/breakout";
import { analyzeWalletClusters } from "@/lib/analysis/clustering";
import { buildAnalysisDataCoverage } from "@/lib/analysis/completeness";
import { readIndexedAnalysisComponents } from "@/lib/analysis/indexedComponents";
import { analyzeContractRisk } from "@/lib/analysis/contract";
import { analyzeDeployer } from "@/lib/analysis/deployer";
import { analyzeManipulation } from "@/lib/analysis/manipulation";
import { analyzeNarrative } from "@/lib/analysis/narrative";
import { aggregateScores, scoreHolders, scoreLiquidity, scoreMomentum } from "@/lib/analysis/scoring";
import { analyzeSmartMoney, enhanceSmartMoneyWithOnchain } from "@/lib/analysis/smartmoney";
import { analyzeTradeability } from "@/lib/analysis/tradeability";
import { buildTacticalInterpretation, classifyTrend } from "@/lib/analysis/interpretation";
import type { HolderGrowthStatus, TokenAnalysis } from "@/lib/analysis/types";
import { fetchBestTokenMarketData } from "@/lib/marketData";
import { getOwnOnchainSnapshot } from "@/lib/onchain/snapshot";
import { getContractRiskProfile, getDeployerProfile, getRecentTokenEvents, getTokenHolders, getTokenOnchainProfile } from "@/lib/onchain";
import { createDataQuality } from "@/lib/onchain/config";
import { getSocialMomentum } from "@/lib/social";
import { enrichToken } from "@/lib/scoring";
import type { TokenWithScores } from "@/lib/types";
import { reconcileHolders, reconcileLiquidity, reconcilePrice, reconcileVolume, summarizeDataQuality } from "@/lib/trust/reconcile";
import { buildTrustedScores } from "@/lib/trust/scores";
import { listWalletIntelligenceEvents, persistAnalysisSnapshot, readLatestAnalysisSnapshot } from "@/lib/db/repository";
import { persistAnalysisSnapshotPostgres } from "@/lib/db/postgres";
import { readHolderWalletIntelligence } from "@/lib/indexer/holderWalletIndexer";
import { prewarmTokenAnalysisData } from "@/lib/indexer/analysisPrewarm";

async function resolveToken(address: string): Promise<{ token: TokenWithScores; candidates: TokenWithScores[]; source: TokenAnalysis["source"] }> {
  const marketCandidates = await fetchBestTokenMarketData(address);
  const candidates = marketCandidates
    .map(enrichToken)
    .sort((a, b) => Number(b.liquidityUsd ?? 0) - Number(a.liquidityUsd ?? 0));
  const direct = candidates[0] ?? null;
  if (direct) return { token: direct, candidates, source: "hybrid" };
  throw new Error(`No market data found for ${address}`);
}

function holderStatus(score: number): HolderGrowthStatus {
  if (score > 70) return "Accelerating";
  if (score > 52) return "Stable";
  if (score > 35) return "Stalling";
  return "Contracting";
}

export async function getTokenAnalysis(address: string): Promise<TokenAnalysis> {
    const { token, candidates, source } = await resolveToken(address);
    const candidatePairs = uniquePairs([token, ...candidates]);
    const enrichmentWarnings: string[] = [];
    const [ownSnapshot, onchainProfile, onchainHolders, onchainRisk, onchainDeployer, onchainEvents, socialMomentum] = await Promise.all([
      withAnalysisDeadline("Base RPC swap windows", getOwnOnchainSnapshot(address, candidatePairs), null, 10_000, enrichmentWarnings),
      withAnalysisDeadline("onchain metadata", getTokenOnchainProfile(address), null, 8_000, enrichmentWarnings),
      withAnalysisDeadline("holder distribution", getTokenHolders(address, { limit: 50 }), null, 8_000, enrichmentWarnings),
      withAnalysisDeadline("contract risk", getContractRiskProfile(address), null, 8_000, enrichmentWarnings),
      withAnalysisDeadline("deployer profile", getDeployerProfile(address), null, 8_000, enrichmentWarnings),
      withAnalysisDeadline("recent events", getRecentTokenEvents(address), [], 8_000, enrichmentWarnings),
      withAnalysisDeadline("social momentum", getSocialMomentum({ tokenAddress: address, symbol: token.symbol, name: token.name, volume24h: token.volume24h, priceChange1h: token.priceChange1h, priceChange24h: token.priceChange24h }), undefined, 4_000, enrichmentWarnings)
    ]);
    let indexed = await readIndexedAnalysisComponents(address);
    if (analysisNeedsImmediatePrewarm({ ownSnapshot, onchainProfile, onchainHolders, onchainRisk, onchainDeployer, onchainEvents, indexed })) {
      await withAnalysisDeadline("analysis prewarm", prewarmTokenAnalysisData(address, { lookbackBlocks: 14_400, runHolderIndexer: true }), null, 15_000, enrichmentWarnings);
      indexed = await readIndexedAnalysisComponents(address);
    }
    const effectiveOwnSnapshot = ownSnapshot ?? indexed.ownData;
    const effectiveOnchainProfile = mergeOnchainProfile(onchainProfile, indexed.profile, enrichmentWarnings);
    const effectiveOnchainHolders = onchainHolders ?? indexed.holders;
    const effectiveOnchainRisk = onchainRisk ?? indexed.risk;
    const effectiveOnchainDeployer = mergeOnchainDeployer(onchainDeployer, indexed.deployer, enrichmentWarnings);
    const effectiveOnchainEvents = onchainEvents.length ? onchainEvents : indexed.events ?? [];
    const momentum = scoreMomentum(token, effectiveOwnSnapshot?.transactionWindows ?? []);
    const liquidity = scoreLiquidity(token);
    const holderMetrics = applyOnchainHolderDistribution(scoreHolders(token), effectiveOnchainHolders);
    const holders = {
      ...holderMetrics,
      holderCount: holderMetrics.holderCount ?? effectiveOnchainProfile?.holdersCount ?? null,
      source: holderMetrics.source ?? (effectiveOnchainProfile?.holdersCount ? effectiveOnchainProfile.dataQuality.source : undefined),
      confidence: holderMetrics.confidence ?? (effectiveOnchainProfile?.holdersCount ? effectiveOnchainProfile.dataQuality.confidence : undefined),
      warnings: holderMetrics.warnings ?? (effectiveOnchainProfile?.holdersCount ? ["Holder count came from token metadata; distribution remains based on sampled holder data."] : undefined),
      walletIntelligence: readHolderWalletIntelligence(address)
    };
    const baseSmartMoney = analyzeSmartMoney(token);
    const smartMoney = await withAnalysisDeadline("wallet enrichment", enhanceSmartMoneyWithOnchain(baseSmartMoney, token, effectiveOnchainHolders, effectiveOnchainDeployer, effectiveOnchainEvents), baseSmartMoney, 700, enrichmentWarnings);
    const clusters = analyzeWalletClusters(smartMoney.wallets);
    const risk = applyOnchainRiskProfile(analyzeContractRisk(token), effectiveOnchainRisk);
    const deployer = applyOnchainDeployer(analyzeDeployer(token), effectiveOnchainDeployer);
    const manipulation = analyzeManipulation(token);
    const narrative = analyzeNarrative(token, socialMomentum);
    const tradeability = analyzeTradeability(token, liquidity);
    const breakoutWatch = analyzeBreakoutWatch({
      token,
      momentum,
      liquidity,
      holders,
      smartMoney,
      narrative,
      tradeability,
      risk,
      manipulation,
      missingData: enrichmentWarnings
    });
    const onchainDataQuality = normalizeOnchainCoverage(
      combineOnchainQuality([effectiveOnchainProfile?.dataQuality, effectiveOnchainHolders?.dataQuality, effectiveOnchainRisk?.dataQuality, effectiveOnchainDeployer?.dataQuality]),
      { onchainProfile: effectiveOnchainProfile, onchainHolders: effectiveOnchainHolders, onchainRisk: effectiveOnchainRisk, onchainDeployer: effectiveOnchainDeployer, onchainEvents: effectiveOnchainEvents }
    );
    const scores = aggregateScores(momentum, liquidity, holders, smartMoney, narrative, tradeability, risk, manipulation);
    const trustedMetrics = buildAnalysisTrustedMetrics({ token, onchainHolders: effectiveOnchainHolders });
    const dataQuality = summarizeDataQuality(Object.values(trustedMetrics));
    if (enrichmentWarnings.length) {
      dataQuality.missingFields = Array.from(new Set([...dataQuality.missingFields, ...enrichmentWarnings.map((warning) => warning.split(" timed out")[0])]));
      dataQuality.disagreementWarnings = Array.from(new Set([...dataQuality.disagreementWarnings, ...enrichmentWarnings]));
      if (dataQuality.confidence === "high") dataQuality.confidence = "medium";
    }
    const trustedScores = buildTrustedScores(scores as unknown as Record<string, number>, dataQuality.missingFields);
    const partial = {
      chainId: 8453 as const,
      address,
      symbol: token.symbol,
      name: token.name,
      updatedAt: new Date().toISOString(),
      source,
      dataQuality,
      trustedMetrics,
      trustedScores,
      scores,
      executiveSummary: {
        opportunityScore: scores.OpportunityScore,
        riskScore: scores.RiskScore,
        momentumScore: scores.MomentumScore,
        liquidityHealthScore: scores.LiquidityHealthScore,
        smartMoneyActivity: scores.SmartMoneyScore > 70 ? "Aggressive inflow" : scores.SmartMoneyScore > 52 ? "Constructive" : "Muted",
        holderGrowthStatus: holderStatus(scores.HolderHealthScore),
        contractSafetyStatus: risk.status,
        currentTrendClassification: classifyTrend({ momentum, liquidity, holders, risk, manipulation, breakoutWatch, ageHours: token.ageHours })
      },
      momentum,
      liquidity,
      holders,
      smartMoney,
      clusters,
      risk,
      deployer,
      manipulation,
      narrative,
      tradeability,
      breakoutWatch,
      marketData: {
        primaryMarketSource: token.primaryMarketSource ?? "Mock",
        marketDataSources: Array.from(new Set([...(token.marketDataSources ?? [token.primaryMarketSource ?? "Mock"]), ...(effectiveOwnSnapshot ? ["BaseRPC" as const] : [])])),
        pairAddress: token.pairAddress,
        dexId: token.dexId,
        sourcePolicy: "Exact contract only. DexScreener and GeckoTerminal are merged for market fields; Base RPC inspects all exact pair candidates by liquidity and overrides raw swap windows when a complete onchain range is indexed."
      },
      onchain: {
        profile: effectiveOnchainProfile ?? undefined,
        holders: effectiveOnchainHolders ?? undefined,
        contractRisk: effectiveOnchainRisk ?? undefined,
        deployer: effectiveOnchainDeployer ?? undefined,
        events: effectiveOnchainEvents,
        dataQuality: onchainDataQuality
      },
      ownData: effectiveOwnSnapshot ? {
        source: effectiveOwnSnapshot.source,
        updatedAt: effectiveOwnSnapshot.updatedAt,
        tokenMetadata: {
          address: effectiveOwnSnapshot.token.address,
          symbol: effectiveOwnSnapshot.token.symbol ?? token.symbol,
          name: effectiveOwnSnapshot.token.name ?? token.name,
          decimals: effectiveOwnSnapshot.token.decimals ?? 18,
          totalSupply: effectiveOwnSnapshot.token.totalSupply
        },
        primaryPool: effectiveOwnSnapshot.primaryPool ? {
          protocol: effectiveOwnSnapshot.primaryPool.protocol,
          address: effectiveOwnSnapshot.primaryPool.address,
          quoteToken: effectiveOwnSnapshot.primaryPool.quoteToken,
          quoteAddress: effectiveOwnSnapshot.primaryPool.quoteAddress,
          fee: effectiveOwnSnapshot.primaryPool.fee
        } : null,
        poolCount: effectiveOwnSnapshot.pools.length,
        transactionWindowsAvailable: effectiveOwnSnapshot.transactionWindows.some((window) => window.complete || window.indexedLogCount > 0),
        transferSummary: effectiveOwnSnapshot.transfers ? {
          transferCount: effectiveOwnSnapshot.transfers.transfers24h,
          uniqueSenders: effectiveOwnSnapshot.transfers.uniqueSenders24h,
          uniqueReceivers: effectiveOwnSnapshot.transfers.uniqueReceivers24h
        } : null
      } : undefined,
      adapters: analysisAdapters
    };
    const dataCoverage = buildAnalysisDataCoverage(partial);
    const coverageMissing = dataCoverage.points
      .filter((point) => point.status === "missing")
      .map((point) => point.label);
    if (coverageMissing.length) {
      partial.dataQuality.missingFields = Array.from(new Set([...partial.dataQuality.missingFields, ...coverageMissing]));
      if (partial.dataQuality.confidence === "high") partial.dataQuality.confidence = "medium";
    }
    const partialWithCoverage = { ...partial, dataCoverage };
    const tacticalSummary = buildTacticalInterpretation(partialWithCoverage);
    const walletEvents = listWalletIntelligenceEvents(12, address).map((event) => ({
      id: event.id,
      type: `wallet_${event.type}`,
      severity: event.severity === "danger" ? "critical" as const : event.severity === "warning" ? "warning" as const : "info" as const,
      message: event.message,
      createdAt: event.createdAt,
      metrics: { source: "local-holder-indexer", ...event.metrics }
    }));
    const liveEvents = [...walletEvents, ...effectiveOnchainEvents.map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity === "danger" ? "critical" as const : event.severity === "warning" ? "warning" as const : "info" as const,
      message: event.message,
      createdAt: event.timestamp,
      metrics: { source: event.source, txHash: event.txHash ?? null, wallet: event.wallet ?? null }
    })), ...buildAnalysisAlerts(partial)].slice(0, 40);
    const analysis = { ...partialWithCoverage, tacticalSummary, liveEvents };
    const previousSnapshot = readLatestAnalysisSnapshot(address, 24 * 60 * 60_000);
    const stableAnalysis = mergeAnalysisWithLastKnownGood(analysis, previousSnapshot);
    const stableCoverage = buildAnalysisDataCoverage(stableAnalysis);
    stableAnalysis.dataCoverage = stableCoverage;
    stableAnalysis.tacticalSummary = buildTacticalInterpretation(stableAnalysis);
    persistAnalysisSnapshot(stableAnalysis);
    void persistAnalysisSnapshotPostgres(stableAnalysis);
    void prewarmTokenAnalysisData(address, { lookbackBlocks: 14_400 }).catch(() => undefined);
    return stableAnalysis;
}

async function withAnalysisDeadline<T>(label: string, promise: Promise<T>, fallback: T, timeoutMs: number, warnings: string[]): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => {
          warnings.push(`${label} timed out after ${timeoutMs}ms`);
          resolve(fallback);
        }, timeoutMs);
      })
    ]);
  } catch {
    warnings.push(`${label} unavailable`);
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function analysisNeedsImmediatePrewarm(input: {
  ownSnapshot: Awaited<ReturnType<typeof getOwnOnchainSnapshot>> | null;
  onchainProfile: Awaited<ReturnType<typeof getTokenOnchainProfile>> | null;
  onchainHolders: Awaited<ReturnType<typeof getTokenHolders>> | null;
  onchainRisk: Awaited<ReturnType<typeof getContractRiskProfile>> | null;
  onchainDeployer: Awaited<ReturnType<typeof getDeployerProfile>> | null;
  onchainEvents: Awaited<ReturnType<typeof getRecentTokenEvents>>;
  indexed: Awaited<ReturnType<typeof readIndexedAnalysisComponents>>;
}) {
  const ownDataReady = Boolean(input.ownSnapshot?.transactionWindows.some((window) => window.complete || window.indexedLogCount > 0) || input.indexed.ownData?.transactionWindows.some((window) => window.complete || window.indexedLogCount > 0));
  const metadataReady = Boolean(input.onchainProfile?.symbol || input.indexed.profile?.symbol);
  const holderReady = Boolean(input.onchainHolders?.totalHolders || input.onchainHolders?.holders.length || input.indexed.holders?.totalHolders || input.indexed.holders?.holders.length || input.onchainProfile?.holdersCount || input.indexed.profile?.holdersCount);
  const riskReady = Boolean(input.onchainRisk || input.indexed.risk);
  const deployerReady = Boolean(input.onchainDeployer?.deployer || input.indexed.deployer?.deployer);
  const eventsReady = Boolean(input.onchainEvents.length || input.indexed.events?.length);
  return !ownDataReady || !metadataReady || !holderReady || !riskReady || !deployerReady || !eventsReady;
}

function applyOnchainHolderDistribution(holders: ReturnType<typeof scoreHolders>, distribution: Awaited<ReturnType<typeof getTokenHolders>> | null) {
  if (!distribution) return holders;
  const knownOwnership = [
    distribution.whalePct ?? 0,
    distribution.lpPct ?? 0,
    distribution.contractPct ?? 0,
    distribution.burnPct ?? 0,
    distribution.deployerPct ?? 0
  ].reduce((sum, value) => sum + value, 0);
  const retailOwnership = distribution.retailPct ?? Math.max(0, 100 - knownOwnership);
  const concentrationRiskScore = distribution.concentrationRisk;
  const countForScoring = distribution.totalHolders ?? distribution.sampledHolderCount ?? distribution.holders.length;
  const holderDistributionQuality = Math.max(0, Math.min(100, 100 - concentrationRiskScore * 0.72 + Math.min(countForScoring / 80, 18)));
  const holderHealthScore = Math.max(0, Math.min(100, holderDistributionQuality * 0.5 + holders.holderVelocity * 0.25 + Math.min(countForScoring / 20, 100) * 0.25));
  return {
    ...holders,
    holderCount: distribution.totalHolders ?? null,
    holderCountIsEstimate: false,
    sampledHolderCount: distribution.sampledHolderCount ?? distribution.holders.length,
    whaleConcentration: distribution.whalePct ?? holders.whaleConcentration,
    top10Ownership: distribution.top10Pct ?? holders.top10Ownership,
    top25Ownership: distribution.top25Pct ?? holders.top25Ownership,
    top50Ownership: distribution.top50Pct,
    deployerOwnership: distribution.deployerPct ?? holders.deployerOwnership,
    lpOwnership: distribution.lpPct,
    contractOwnership: distribution.contractPct,
    burnOwnership: distribution.burnPct,
    retailOwnership,
    holderDistributionQuality,
    holderHealthScore,
    concentrationRiskScore,
    source: distribution.dataQuality.source,
    confidence: distribution.dataQuality.confidence,
    warnings: distribution.dataQuality.warnings,
    actionableSignals: distribution.actionableSignals,
    topHolders: distribution.holders.slice(0, 10).map((holder) => ({
      address: holder.address,
      label: holder.label,
      category: holder.category,
      ownershipPct: holder.ownershipPct,
      balanceFormatted: holder.balanceFormatted,
      isContract: holder.isContract
    })),
    ownershipDistribution: [
      { bucket: "Whales", ownership: distribution.whalePct ?? 0 },
      { bucket: "LP", ownership: distribution.lpPct ?? 0 },
      { bucket: "Contracts", ownership: distribution.contractPct ?? 0 },
      { bucket: "Burn", ownership: distribution.burnPct ?? 0 },
      { bucket: "Retail", ownership: retailOwnership }
    ].filter((bucket) => bucket.ownership > 0)
  };
}

function applyOnchainRiskProfile(risk: ReturnType<typeof analyzeContractRisk>, profile: Awaited<ReturnType<typeof getContractRiskProfile>> | null) {
  if (!profile) return risk;
  return {
    ...risk,
    mintable: Boolean(profile.canMint),
    pausable: Boolean(profile.canPause),
    blacklistable: Boolean(profile.canBlacklist),
    proxyUpgradeable: Boolean(profile.isProxy),
    maxWallet: Boolean(profile.maxWallet),
    maxTx: Boolean(profile.maxTx),
    hiddenTaxes: Boolean(profile.hasTransferTax),
    suspiciousPermissions: profile.riskFlags.some((flag) => flag.severity === "danger"),
    ContractSafetyScore: profile.contractSafetyScore,
    RugRiskScore: Math.max(0, 100 - profile.contractSafetyScore),
    status: profile.contractSafetyScore > 75 ? "No critical risk detected" as const : profile.contractSafetyScore > 45 ? "Caution" as const : "High-risk pattern detected" as const
  };
}

function buildAnalysisTrustedMetrics(input: { token: TokenWithScores; onchainHolders: Awaited<ReturnType<typeof getTokenHolders>> | null }) {
  const updatedAt = input.token.updatedAt;
  return {
    price: reconcilePrice([{ source: input.token.primaryMarketSource ?? "market-provider", value: input.token.priceUsd, updatedAt, confidence: "medium" }]),
    liquidity: reconcileLiquidity([{ source: input.token.primaryMarketSource ?? "market-provider", value: input.token.liquidityUsd, updatedAt, confidence: "medium" }]),
    volume24h: reconcileVolume([{ source: input.token.primaryMarketSource ?? "market-provider", value: input.token.volume24h, updatedAt, confidence: "medium" }]),
    holders: reconcileHolders([
      { source: input.onchainHolders?.dataQuality.source ?? "indexer", value: input.onchainHolders?.totalHolders ?? null, updatedAt: input.onchainHolders?.dataQuality.fetchedAt, confidence: input.onchainHolders?.dataQuality.confidence ?? "low", warnings: input.onchainHolders?.dataQuality.warnings ?? ["Exact holder count unavailable."] }
    ])
  };
}

function applyOnchainDeployer(deployer: ReturnType<typeof analyzeDeployer>, profile: Awaited<ReturnType<typeof getDeployerProfile>> | null) {
  if (!profile) return deployer;
  return {
    ...deployer,
    address: profile.deployer ?? deployer.address,
    DeployerReputationScore: profile.reputationScore,
    previousLaunches: Array.isArray(profile.priorLaunches) ? profile.priorLaunches.length : deployer.previousLaunches,
    walletAgeDays: profile.createdAt ? Math.max(0, Math.round((Date.now() - new Date(profile.createdAt).getTime()) / 864e5)) : deployer.walletAgeDays
  };
}

function mergeOnchainProfile(
  live: Awaited<ReturnType<typeof getTokenOnchainProfile>> | null,
  indexed: Awaited<ReturnType<typeof getTokenOnchainProfile>> | null,
  warnings: string[]
) {
  if (!live) {
    if (indexed) warnings.push("onchain metadata filled from indexed snapshot");
    return indexed;
  }
  if (!indexed) return live;
  const merged = {
    ...live,
    name: live.name ?? indexed.name,
    symbol: live.symbol ?? indexed.symbol,
    decimals: live.decimals ?? indexed.decimals,
    totalSupply: live.totalSupply ?? indexed.totalSupply,
    owner: live.owner ?? indexed.owner,
    deployer: live.deployer ?? indexed.deployer,
    createdAt: live.createdAt ?? indexed.createdAt,
    creationTxHash: live.creationTxHash ?? indexed.creationTxHash,
    verified: live.verified ?? indexed.verified,
    holdersCount: live.holdersCount ?? indexed.holdersCount,
    transferCount24h: live.transferCount24h ?? indexed.transferCount24h
  };
  if (live.dataQuality.missingFields.length > merged.dataQuality.missingFields.length || JSON.stringify(live) !== JSON.stringify(merged)) {
    warnings.push("onchain metadata supplemented from indexed snapshot");
  }
  return merged;
}

function mergeOnchainDeployer(
  live: Awaited<ReturnType<typeof getDeployerProfile>> | null,
  indexed: Awaited<ReturnType<typeof getDeployerProfile>> | null,
  warnings: string[]
) {
  if (!live) {
    if (indexed) warnings.push("deployer profile filled from indexed snapshot");
    return indexed;
  }
  if (!indexed || live.deployer) return live;
  warnings.push("deployer profile supplemented from indexed snapshot");
  return {
    ...live,
    deployer: indexed.deployer,
    creationTxHash: live.creationTxHash ?? indexed.creationTxHash,
    createdAt: live.createdAt ?? indexed.createdAt,
    deployerEthBalance: live.deployerEthBalance ?? indexed.deployerEthBalance,
    priorLaunches: live.priorLaunches?.length ? live.priorLaunches : indexed.priorLaunches,
    reputationScore: live.reputationScore === 50 ? indexed.reputationScore : live.reputationScore
  };
}

function combineOnchainQuality(qualities: Array<import("@/lib/onchain/types").DataQuality | undefined>) {
  const present = qualities.filter(Boolean) as import("@/lib/onchain/types").DataQuality[];
  if (!present.length) return createDataQuality({ source: "onchain", sourcesTried: ["BaseRPC", "Blockscout", "BaseScan"], confidence: "low", isPartial: true, missingFields: ["profile", "holders", "risk", "deployer"], warnings: ["No onchain adapter returned data."] });
  return createDataQuality({
    source: present.map((quality) => quality.source).join(" + "),
    sourcesTried: [...new Set(present.flatMap((quality) => quality.sourcesTried))],
    confidence: present.some((quality) => quality.confidence === "high") ? "medium" : "low",
    isPartial: present.some((quality) => quality.isPartial),
    missingFields: [...new Set(present.flatMap((quality) => quality.missingFields))],
    warnings: [...new Set(present.flatMap((quality) => quality.warnings))]
  });
}

function normalizeOnchainCoverage(
  quality: import("@/lib/onchain/types").DataQuality,
  coverage: {
    onchainProfile: Awaited<ReturnType<typeof getTokenOnchainProfile>> | null;
    onchainHolders: Awaited<ReturnType<typeof getTokenHolders>> | null;
    onchainRisk: Awaited<ReturnType<typeof getContractRiskProfile>> | null;
    onchainDeployer: Awaited<ReturnType<typeof getDeployerProfile>> | null;
    onchainEvents: Awaited<ReturnType<typeof getRecentTokenEvents>>;
  }
) {
  const covered = new Set<string>();
  if (coverage.onchainProfile?.name && coverage.onchainProfile.symbol) covered.add("profile");
  if (coverage.onchainProfile) covered.add("onchain metadata");
  if (coverage.onchainHolders?.totalHolders || coverage.onchainHolders?.holders.length) {
    covered.add("holders");
    covered.add("holder distribution");
  }
  if (coverage.onchainRisk) {
    covered.add("risk");
    covered.add("contract risk");
    covered.add("verifiedSource");
    covered.add("abi");
  }
  if (coverage.onchainDeployer?.deployer) {
    covered.add("deployer");
    covered.add("deployer profile");
  }
  if (Array.isArray(coverage.onchainEvents)) covered.add("recent events");

  const missingFields = quality.missingFields.filter((field) => !covered.has(field));
  return {
    ...quality,
    missingFields,
    isPartial: missingFields.length > 0 || quality.warnings.length > 0,
    confidence: missingFields.length === 0 && quality.confidence === "low" ? "medium" as const : quality.confidence
  };
}

function uniquePairs(tokens: TokenWithScores[]) {
  const seen = new Set<string>();
  return tokens
    .filter((token) => token.pairAddress)
    .map((token) => ({
      pairAddress: token.pairAddress,
      dexId: token.dexId,
      quoteTokenAddress: token.quoteTokenAddress,
      quoteTokenSymbol: token.quoteTokenSymbol
    }))
    .filter((pair) => {
      const key = pair.pairAddress.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
