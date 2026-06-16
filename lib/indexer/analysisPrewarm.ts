import { fetchBestTokenMarketData } from "@/lib/marketData";
import { getOwnOnchainSnapshot, type OwnOnchainSnapshot } from "@/lib/onchain/snapshot";
import { normalizeAddress } from "@/lib/onchain/config";
import { getContractRiskProfile, getDeployerProfile, getRecentTokenEvents, getTokenHolders, getTokenOnchainProfile } from "@/lib/onchain";
import { persistOnchainComponentSnapshot, persistTokenSnapshots, upsertTrackedIndexerToken, type OnchainComponentName } from "@/lib/db/repository";
import { persistOnchainComponentSnapshotPostgres } from "@/lib/db/postgres";
import { indexTokenHolderWallets } from "@/lib/indexer/holderWalletIndexer";
import type { ContractRiskProfile, DeployerProfile, HolderDistribution, OnchainTokenProfile, RecentTokenEvent } from "@/lib/onchain/types";
import type { TokenSnapshot } from "@/lib/types";

export interface AnalysisPrewarmResult {
  tokenAddress: string;
  startedAt: string;
  finishedAt: string;
  marketCandidates: number;
  components: Record<OnchainComponentName, "stored" | "missing" | "error">;
  holderIndexer: {
    status: "ok" | "partial" | "error" | "skipped";
    transferCount: number;
    walletCount: number;
  };
  warnings: string[];
}

export async function prewarmTokenAnalysisData(address: string, options: { lookbackBlocks?: number; runHolderIndexer?: boolean } = {}): Promise<AnalysisPrewarmResult> {
  const tokenAddress = normalizeAddress(address);
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const components: AnalysisPrewarmResult["components"] = {
    profile: "missing",
    holders: "missing",
    risk: "missing",
    deployer: "missing",
    events: "missing",
    ownData: "missing"
  };
  let marketCandidates: TokenSnapshot[] = [];

  try {
    marketCandidates = await fetchBestTokenMarketData(tokenAddress);
    if (marketCandidates.length) {
      persistTokenSnapshots(marketCandidates, "analysis_prewarm");
      const best = marketCandidates[0];
      upsertTrackedIndexerToken({
        tokenAddress,
        symbol: best?.symbol,
        name: best?.name,
        reason: "analysis_prewarm",
        priority: 100
      });
    }
  } catch (error) {
    warnings.push(`Market prewarm failed: ${errorMessage(error)}`);
  }

  const pairHints = marketCandidates
    .filter((token) => token.pairAddress)
    .map((token) => ({
      pairAddress: token.pairAddress,
      dexId: token.dexId,
      quoteTokenAddress: token.quoteTokenAddress,
      quoteTokenSymbol: token.quoteTokenSymbol
    }));

  const [ownData, profile, holders, risk, deployer, events] = await Promise.all([
    settleComponent("ownData", () => getOwnOnchainSnapshot(tokenAddress, pairHints), components, warnings),
    settleComponent("profile", () => getTokenOnchainProfile(tokenAddress), components, warnings),
    settleComponent("holders", () => getTokenHolders(tokenAddress, { limit: 100 }), components, warnings),
    settleComponent("risk", () => getContractRiskProfile(tokenAddress), components, warnings),
    settleComponent("deployer", () => getDeployerProfile(tokenAddress), components, warnings),
    settleComponent("events", () => getRecentTokenEvents(tokenAddress), components, warnings)
  ]);

  persistComponent(tokenAddress, "ownData", ownData, ownData ? { source: ownData.source, fetchedAt: ownData.updatedAt } : undefined);
  persistComponent(tokenAddress, "profile", profile, profile?.dataQuality);
  persistComponent(tokenAddress, "holders", holders, holders?.dataQuality);
  persistComponent(tokenAddress, "risk", risk, risk?.dataQuality);
  persistComponent(tokenAddress, "deployer", deployer, deployer?.dataQuality);
  persistComponent(tokenAddress, "events", events, events?.length ? { source: [...new Set(events.map((event) => event.source))].join(" + "), fetchedAt: new Date().toISOString() } : undefined);

  let holderIndexer: AnalysisPrewarmResult["holderIndexer"] = { status: "skipped", transferCount: 0, walletCount: 0 };
  if (options.runHolderIndexer ?? true) {
    try {
      const result = await indexTokenHolderWallets(tokenAddress, { lookbackBlocks: options.lookbackBlocks ?? 14_400 });
      holderIndexer = {
        status: result.status,
        transferCount: result.transferCount,
        walletCount: result.walletCount
      };
      warnings.push(...result.warnings);
    } catch (error) {
      holderIndexer = { status: "error", transferCount: 0, walletCount: 0 };
      warnings.push(`Holder-wallet indexer failed: ${errorMessage(error)}`);
    }
  }

  return {
    tokenAddress,
    startedAt,
    finishedAt: new Date().toISOString(),
    marketCandidates: marketCandidates.length,
    components,
    holderIndexer,
    warnings: [...new Set(warnings)]
  };
}

async function settleComponent<T>(component: OnchainComponentName, run: () => Promise<T>, components: AnalysisPrewarmResult["components"], warnings: string[]): Promise<T | null> {
  try {
    const value = await run();
    components[component] = hasUsefulValue(value) ? "stored" : "missing";
    return value;
  } catch (error) {
    components[component] = "error";
    warnings.push(`${component} prewarm failed: ${errorMessage(error)}`);
    return null;
  }
}

function persistComponent(tokenAddress: string, component: "ownData", payload: OwnOnchainSnapshot | null, dataQuality?: unknown): void;
function persistComponent(tokenAddress: string, component: "profile", payload: OnchainTokenProfile | null, dataQuality?: unknown): void;
function persistComponent(tokenAddress: string, component: "holders", payload: HolderDistribution | null, dataQuality?: unknown): void;
function persistComponent(tokenAddress: string, component: "risk", payload: ContractRiskProfile | null, dataQuality?: unknown): void;
function persistComponent(tokenAddress: string, component: "deployer", payload: DeployerProfile | null, dataQuality?: unknown): void;
function persistComponent(tokenAddress: string, component: "events", payload: RecentTokenEvent[] | null, dataQuality?: unknown): void;
function persistComponent(tokenAddress: string, component: OnchainComponentName, payload: unknown, dataQuality?: any) {
  const snapshot = {
    tokenAddress,
    component,
    payload,
    dataQuality,
    confidence: dataQuality?.confidence ?? null,
    observedAt: dataQuality?.fetchedAt ?? dataQuality?.updatedAt ?? new Date().toISOString()
  } as const;
  persistOnchainComponentSnapshot(snapshot);
  void persistOnchainComponentSnapshotPostgres(snapshot);
}

function hasUsefulValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}
