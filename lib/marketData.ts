import { fetchDexToken } from "@/lib/dexscreener";
import { fetchGeckoTokenPools } from "@/lib/geckoterminal";
import type { TokenSnapshot } from "@/lib/types";

type Source = NonNullable<TokenSnapshot["primaryMarketSource"]>;
type MetricKey = keyof Pick<
  TokenSnapshot,
  | "priceUsd"
  | "fdv"
  | "marketCap"
  | "liquidityUsd"
  | "volume5m"
  | "volume1h"
  | "volume6h"
  | "volume24h"
  | "priceChange5m"
  | "priceChange1h"
  | "priceChange6h"
  | "priceChange24h"
  | "txns5mBuys"
  | "txns5mSells"
  | "txns1hBuys"
  | "txns1hSells"
  | "txns6hBuys"
  | "txns6hSells"
  | "txns24hBuys"
  | "txns24hSells"
>;

const MARKET_KEYS: MetricKey[] = [
  "priceUsd",
  "fdv",
  "marketCap",
  "liquidityUsd",
  "volume5m",
  "volume1h",
  "volume6h",
  "volume24h",
  "priceChange5m",
  "priceChange1h",
  "priceChange6h",
  "priceChange24h",
  "txns5mBuys",
  "txns5mSells",
  "txns1hBuys",
  "txns1hSells",
  "txns6hBuys",
  "txns6hSells",
  "txns24hBuys",
  "txns24hSells"
];

export async function fetchBestTokenMarketData(address: string): Promise<TokenSnapshot[]> {
  const exact = await fetchTokenMarketProviderSnapshots(address);
  if (!exact.length) return [];

  const byPair = new Map<string, TokenSnapshot[]>();
  for (const token of exact) {
    const key = token.pairAddress.toLowerCase() || `${token.primaryMarketSource}-${token.tokenAddress.toLowerCase()}`;
    byPair.set(key, [...(byPair.get(key) ?? []), token]);
  }

  return [...byPair.values()].map(mergeProviderSnapshots).sort((a, b) => Number(b.liquidityUsd ?? 0) - Number(a.liquidityUsd ?? 0));
}

export async function fetchTokenMarketProviderSnapshots(address: string): Promise<TokenSnapshot[]> {
  const [dex, gecko] = await Promise.all([
    fetchDexToken(address).catch(() => []),
    fetchGeckoTokenPools(address).catch(() => [])
  ]);

  const exact = [...dex, ...gecko].filter((token) => token.tokenAddress.toLowerCase() === address.toLowerCase());
  return exact.sort((a, b) => Number(b.liquidityUsd ?? 0) - Number(a.liquidityUsd ?? 0));
}

function mergeProviderSnapshots(snapshots: TokenSnapshot[]): TokenSnapshot {
  const primary = snapshots.slice().sort(compareSnapshotQuality)[0];
  const secondary = snapshots.filter((snapshot) => snapshot !== primary).sort(compareSnapshotQuality);
  const merged: TokenSnapshot = { ...primary };

  for (const key of MARKET_KEYS) {
    if (merged[key] === null) {
      const fill = secondary.find((snapshot) => snapshot[key] !== null);
      if (fill) merged[key] = fill[key] as never;
    }
  }

  const sources = new Set(snapshots.flatMap((snapshot) => snapshot.marketDataSources ?? [snapshot.primaryMarketSource ?? "Mock"]));
  merged.marketDataSources = [...sources];
  merged.primaryMarketSource = primary.primaryMarketSource;
  merged.updatedAt = new Date(Math.max(...snapshots.map((snapshot) => new Date(snapshot.updatedAt).getTime()))).toISOString();
  return merged;
}

function compareSnapshotQuality(a: TokenSnapshot, b: TokenSnapshot) {
  // Market-source priority: DexScreener usually updates fastest for active pairs, then GeckoTerminal,
  // with liquidity depth as the tiebreaker so the displayed pair reflects the tradeable venue.
  const sourceScore = (source: Source | undefined) => source === "DexScreener" ? 3 : source === "GeckoTerminal" ? 2 : 1;
  return sourceScore(b.primaryMarketSource) - sourceScore(a.primaryMarketSource) || Number(b.liquidityUsd ?? 0) - Number(a.liquidityUsd ?? 0);
}
