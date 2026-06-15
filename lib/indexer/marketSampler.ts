import { getIndexerCandidateTokens, persistTokenSnapshots, refreshWalletEventPerformance } from "@/lib/db/repository";
import { fetchBestTokenMarketData, fetchTokenMarketProviderSnapshots } from "@/lib/marketData";

export interface MarketSamplerResult {
  startedAt: string;
  finishedAt: string;
  requestedCount: number;
  sampledCount: number;
  snapshotCount: number;
  performanceRecordsRefreshed: number;
  candidates: Array<{ tokenAddress: string; symbol?: string | null; reason: string }>;
  warnings: string[];
}

export async function sampleTrackedTokenMarkets(options: { addresses?: string[]; limit?: number } = {}): Promise<MarketSamplerResult> {
  const startedAt = new Date().toISOString();
  const explicit = dedupeAddresses(options.addresses ?? []);
  const candidates = explicit.length
    ? explicit.map((tokenAddress) => ({ tokenAddress, symbol: null, reason: "explicit" }))
    : getIndexerCandidateTokens(options.limit ?? 5).map((candidate) => ({
      tokenAddress: candidate.tokenAddress,
      symbol: candidate.symbol,
      reason: candidate.reason ?? "tracked-token"
    }));
  const capped = candidates.slice(0, Math.max(1, Math.min(options.limit ?? 10, 20)));
  const warnings: string[] = [];
  let sampledCount = 0;
  let snapshotCount = 0;

  for (const candidate of capped) {
    try {
      const snapshots = await fetchBestTokenMarketData(candidate.tokenAddress);
      const providerSnapshots = await fetchTokenMarketProviderSnapshots(candidate.tokenAddress);
      if (!snapshots.length) {
        warnings.push(`${candidate.tokenAddress}: no market data returned from DexScreener or GeckoTerminal`);
        continue;
      }
      const persisted = persistTokenSnapshots(snapshots, "market_sampler");
      if (providerSnapshots.length) persistTokenSnapshots(providerSnapshots, "provider_compare");
      if (!persisted.ok) {
        warnings.push(`${candidate.tokenAddress}: ${persisted.error}`);
        continue;
      }
      sampledCount += 1;
      snapshotCount += snapshots.length;
    } catch (error) {
      warnings.push(`${candidate.tokenAddress}: ${error instanceof Error ? error.message : "market sampling failed"}`);
    }
  }

  const refreshed = refreshWalletEventPerformance(200);
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    requestedCount: candidates.length,
    sampledCount,
    snapshotCount,
    performanceRecordsRefreshed: refreshed.length,
    candidates: capped,
    warnings
  };
}

function dedupeAddresses(addresses: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const address of addresses) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) continue;
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
