import { getBlockNumber } from "@/lib/onchain/client";
import { normalizeAddress } from "@/lib/onchain/config";
import { getTokenTransferLogs } from "@/lib/onchain/transfers";
import {
  getIndexerCandidateTokens,
  getHolderIntelligenceSummary,
  persistWalletIntelligenceEvents,
  persistHolderIndexerRun,
  persistTokenTransferObservations,
  upsertWalletTokenObservations,
  type HolderIntelligenceSummary,
  type WalletIntelligenceEvent
} from "@/lib/db/repository";
import type { TokenTransfer } from "@/lib/onchain/types";

export interface HolderIndexerOptions {
  fromBlock?: number;
  toBlock?: number;
  lookbackBlocks?: number;
}

export interface HolderIndexerResult {
  tokenAddress: string;
  fromBlock: number;
  toBlock: number;
  transferCount: number;
  walletCount: number;
  status: "ok" | "partial" | "error";
  warnings: string[];
  startedAt: string;
  finishedAt: string;
  summary: HolderIntelligenceSummary;
}

export interface HolderIndexerBatchOptions extends HolderIndexerOptions {
  addresses?: string[];
  limit?: number;
}

export interface HolderIndexerBatchResult {
  startedAt: string;
  finishedAt: string;
  requestedCount: number;
  indexedCount: number;
  skippedCount: number;
  lookbackBlocks: number;
  candidates: Array<{ tokenAddress: string; symbol?: string | null; reason: string }>;
  results: HolderIndexerResult[];
  warnings: string[];
}

export async function indexTokenHolderWallets(address: string, options: HolderIndexerOptions = {}): Promise<HolderIndexerResult> {
  const tokenAddress = normalizeAddress(address);
  const startedAt = new Date().toISOString();
  const latest = options.toBlock ?? await getBlockNumber();
  const lookbackBlocks = Math.max(100, Math.min(options.lookbackBlocks ?? 14_400, 43_200));
  const fromBlock = Math.max(0, options.fromBlock ?? latest - lookbackBlocks);
  const warnings: string[] = [];
  let status: HolderIndexerResult["status"] = "ok";
  let transfers: TokenTransfer[] = [];

  try {
    transfers = await getTokenTransferLogs(tokenAddress, fromBlock, latest);
    if (!transfers.length) {
      status = "partial";
      warnings.push("No Transfer logs were returned for this window. The token may be inactive, the RPC may have limited the range, or the token may not emit standard ERC-20 Transfer events.");
    }
    persistTokenTransferObservations(tokenAddress, transfers, startedAt);
    upsertWalletTokenObservations(tokenAddress, transfers, startedAt);
  } catch (error) {
    status = "error";
    warnings.push(error instanceof Error ? error.message : "Transfer indexing failed.");
  }

  const summary = getHolderIntelligenceSummary(tokenAddress);
  const finishedAt = new Date().toISOString();
  const walletCount = summary.indexedWalletCount;
  persistHolderIndexerRun({
    tokenAddress,
    fromBlock,
    toBlock: latest,
    transferCount: transfers.length,
    walletCount,
    status,
    warnings,
    startedAt,
    finishedAt
  });
  persistWalletIntelligenceEvents(buildWalletIntelligenceEvents(tokenAddress, {
    fromBlock,
    toBlock: latest,
    transferCount: transfers.length,
    walletCount,
    status,
    warnings,
    finishedAt,
    summary: getHolderIntelligenceSummary(tokenAddress)
  }));

  return {
    tokenAddress,
    fromBlock,
    toBlock: latest,
    transferCount: transfers.length,
    walletCount,
    status,
    warnings,
    startedAt,
    finishedAt,
    summary: getHolderIntelligenceSummary(tokenAddress)
  };
}

function buildWalletIntelligenceEvents(tokenAddress: string, input: {
  fromBlock: number;
  toBlock: number;
  transferCount: number;
  walletCount: number;
  status: HolderIndexerResult["status"];
  warnings: string[];
  finishedAt: string;
  summary: HolderIntelligenceSummary;
}): WalletIntelligenceEvent[] {
  const baseMetrics = {
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
    transferCount: input.transferCount,
    walletCount: input.walletCount,
    indexedTransferCount: input.summary.indexedTransferCount,
    indexedWalletCount: input.summary.indexedWalletCount,
    netAccumulatorWallets: input.summary.netAccumulatorWallets,
    netDistributorWallets: input.summary.netDistributorWallets
  };
  const events: WalletIntelligenceEvent[] = [];
  if (input.status !== "ok") {
    events.push({
      id: eventId(tokenAddress, "indexer_partial", input.fromBlock, input.toBlock),
      tokenAddress,
      type: "indexer_partial",
      severity: "warning",
      message: "Holder indexer returned partial local coverage for this token.",
      metrics: { ...baseMetrics, warning: input.warnings[0] ?? null },
      createdAt: input.finishedAt
    });
  }
  if (input.transferCount > 0) {
    events.push({
      id: eventId(tokenAddress, "wallet_memory_built", input.fromBlock, input.toBlock),
      tokenAddress,
      type: "wallet_memory_built",
      severity: "info",
      message: "Local wallet memory updated from observed Transfer logs.",
      metrics: baseMetrics,
      createdAt: input.finishedAt
    });
  }
  if (input.transferCount >= 500 || input.walletCount >= 100) {
    events.push({
      id: eventId(tokenAddress, "transfer_activity", input.fromBlock, input.toBlock),
      tokenAddress,
      type: "transfer_activity",
      severity: "alpha",
      message: "Elevated observed transfer activity in the indexed window.",
      metrics: baseMetrics,
      createdAt: input.finishedAt
    });
  }
  const totalDirectional = input.summary.netAccumulatorWallets + input.summary.netDistributorWallets;
  const accumulatorShare = totalDirectional ? input.summary.netAccumulatorWallets / totalDirectional : 0;
  const distributorShare = totalDirectional ? input.summary.netDistributorWallets / totalDirectional : 0;
  if (totalDirectional >= 20 && accumulatorShare >= 0.62) {
    events.push({
      id: eventId(tokenAddress, "accumulation_pressure", input.fromBlock, input.toBlock),
      tokenAddress,
      type: "accumulation_pressure",
      severity: "alpha",
      message: "Observed wallet flow leans toward net accumulation in local coverage.",
      metrics: { ...baseMetrics, accumulatorShare: Number(accumulatorShare.toFixed(4)) },
      createdAt: input.finishedAt
    });
  }
  if (totalDirectional >= 20 && distributorShare >= 0.62) {
    events.push({
      id: eventId(tokenAddress, "distribution_pressure", input.fromBlock, input.toBlock),
      tokenAddress,
      type: "distribution_pressure",
      severity: "warning",
      message: "Observed wallet flow leans toward net distribution in local coverage.",
      metrics: { ...baseMetrics, distributorShare: Number(distributorShare.toFixed(4)) },
      createdAt: input.finishedAt
    });
  }
  return events;
}

function eventId(tokenAddress: string, type: string, fromBlock: number, toBlock: number) {
  return `${tokenAddress}:${type}:${fromBlock}:${toBlock}`;
}

export function readHolderWalletIntelligence(address: string) {
  return getHolderIntelligenceSummary(normalizeAddress(address));
}

export async function indexTrackedHolderWallets(options: HolderIndexerBatchOptions = {}): Promise<HolderIndexerBatchResult> {
  const startedAt = new Date().toISOString();
  const lookbackBlocks = Math.max(100, Math.min(options.lookbackBlocks ?? 3_600, 14_400));
  const explicit = dedupeAddresses(options.addresses ?? []);
  const candidates = explicit.length
    ? explicit.map((tokenAddress) => ({ tokenAddress, symbol: null, reason: "explicit" }))
    : getIndexerCandidateTokens(options.limit ?? 5).map((candidate) => ({
      tokenAddress: candidate.tokenAddress,
      symbol: candidate.symbol,
      reason: candidate.indexedTransfers ? "least-recently-covered" : "no-local-transfer-coverage"
    }));
  const capped = candidates.slice(0, Math.max(1, Math.min(options.limit ?? 5, 10)));
  const results: HolderIndexerResult[] = [];
  const warnings: string[] = [];

  for (const candidate of capped) {
    try {
      const result = await indexTokenHolderWallets(candidate.tokenAddress, { lookbackBlocks });
      results.push(result);
    } catch (error) {
      warnings.push(`${candidate.tokenAddress}: ${error instanceof Error ? error.message : "indexing failed"}`);
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    requestedCount: candidates.length,
    indexedCount: results.length,
    skippedCount: Math.max(0, candidates.length - capped.length),
    lookbackBlocks,
    candidates: capped,
    results,
    warnings
  };
}

function dedupeAddresses(addresses: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const address of addresses) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) continue;
    const normalized = normalizeAddress(address);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
