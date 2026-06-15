import { searchDexScreener } from "@/lib/dexscreener";
import { CACHE_TTLS } from "@/lib/freshness";
import { fetchNewBasePools, fetchTrendingBasePools } from "@/lib/geckoterminal";
import { fetchBestTokenMarketData } from "@/lib/marketData";
import { mergeTokenSnapshots } from "@/lib/normalize";
import { enrichToken } from "@/lib/scoring";
import { withCache } from "@/lib/storage";
import { listRecentTokenSnapshots, persistTokenSnapshots } from "@/lib/db/repository";
import type { TokenSnapshot, TokenWithScores } from "@/lib/types";

const DISCOVERY_FALLBACK_MAX_AGE_MS = 30 * 60_000;

export type TokenFeedResult = {
  tokens: TokenWithScores[];
  source: string;
  dataPolicy: "live" | "recent-cache";
  warnings: string[];
};

export async function getTrendingTokens(): Promise<TokenWithScores[]> {
  return (await getTrendingTokenFeed()).tokens;
}

export async function getTrendingTokenFeed(): Promise<TokenFeedResult> {
  const tokens = await withCache("tokens:trending", CACHE_TTLS.geckoDiscoveryMs, async () => {
    const trending = await fetchTrendingBasePools();
    return mergeTokenSnapshots(trending);
  }).catch(() => []);
  const ranked = rank(tokens);
  if (ranked.length) {
    persistTokenSnapshots(ranked, "trending");
    return { tokens: ranked, source: "GeckoTerminal live public API", dataPolicy: "live", warnings: [] };
  }
  const fallback = rank(listRecentTokenSnapshots(["trending"], DISCOVERY_FALLBACK_MAX_AGE_MS, 50));
  return {
    tokens: fallback,
    source: "Recent persisted market snapshots",
    dataPolicy: "recent-cache",
    warnings: fallback.length
      ? ["Live GeckoTerminal discovery is unavailable or rate-limited. Showing recent persisted observations with original source timestamps."]
      : ["No live trending pools or recent persisted observations are available. Data is intentionally left empty instead of using mock values."]
  };
}

export async function getNewTokens(): Promise<TokenWithScores[]> {
  return (await getNewTokenFeed()).tokens;
}

export async function getNewTokenFeed(): Promise<TokenFeedResult> {
  const tokens = await withCache("tokens:new", CACHE_TTLS.geckoDiscoveryMs, async () => {
    const fresh = await fetchNewBasePools();
    return mergeTokenSnapshots(fresh);
  }).catch(() => []);
  const ranked = rank(tokens);
  if (ranked.length) {
    persistTokenSnapshots(ranked, "new");
    return { tokens: ranked, source: "GeckoTerminal live public API", dataPolicy: "live", warnings: [] };
  }
  const fallback = rank(listRecentTokenSnapshots(["new"], DISCOVERY_FALLBACK_MAX_AGE_MS, 50));
  return {
    tokens: fallback,
    source: "Recent persisted market snapshots",
    dataPolicy: "recent-cache",
    warnings: fallback.length
      ? ["Live GeckoTerminal new-pool discovery is unavailable or rate-limited. Showing recent persisted observations with original source timestamps."]
      : ["No live new pools or recent persisted observations are available. Data is intentionally left empty instead of using mock values."]
  };
}

export async function searchTokens(query: string): Promise<TokenWithScores[]> {
  const tokens = await withCache(`tokens:search:${query.toLowerCase()}`, CACHE_TTLS.dexSearchMs, async () => {
    const search = await searchDexScreener(query);
    return mergeTokenSnapshots(search);
  });
  const ranked = rank(tokens);
  persistTokenSnapshots(ranked, "search");
  return ranked;
}

export async function getTokenByAddress(address: string): Promise<TokenWithScores | null> {
  const tokens = await withCache(`tokens:address:${address.toLowerCase()}`, CACHE_TTLS.dexAddressMs, async () => {
    const found = await fetchBestTokenMarketData(address);
    return mergeTokenSnapshots(found);
  });
  const ranked = tokens.map(enrichToken).sort((a, b) => Number(b.liquidityUsd ?? 0) - Number(a.liquidityUsd ?? 0));
  persistTokenSnapshots(ranked, "address_lookup");
  return ranked[0] ?? null;
}

export function rank(tokens: TokenSnapshot[]): TokenWithScores[] {
  return tokens.map(enrichToken).sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore);
}
