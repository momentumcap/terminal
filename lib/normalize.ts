import { BASE_CHAIN_ID, type TokenSnapshot } from "@/lib/types";

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const positiveNum = (value: unknown): number | null => {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const nonNegativeNum = (value: unknown): number | null => {
  const parsed = num(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
};

const str = (value: unknown, fallback = ""): string => (typeof value === "string" && value ? value : fallback);

export function normalizeDexScreenerPair(pair: any): TokenSnapshot {
  const token = pair?.baseToken ?? {};
  const quote = pair?.quoteToken ?? {};
  const txns = pair?.txns ?? {};
  const volume = pair?.volume ?? {};
  const priceChange = pair?.priceChange ?? {};

  return {
    chainId: BASE_CHAIN_ID,
    tokenAddress: str(token.address, str(pair?.baseToken?.address, pair?.pairAddress)),
    symbol: str(token.symbol, "UNKNOWN"),
    name: str(token.name, "Unknown Token"),
    priceUsd: positiveNum(pair?.priceUsd),
    fdv: positiveNum(pair?.fdv),
    marketCap: positiveNum(pair?.marketCap),
    liquidityUsd: nonNegativeNum(pair?.liquidity?.usd),
    volume5m: nonNegativeNum(volume.m5),
    volume1h: nonNegativeNum(volume.h1),
    volume6h: nonNegativeNum(volume.h6),
    volume24h: nonNegativeNum(volume.h24),
    priceChange5m: num(priceChange.m5),
    priceChange1h: num(priceChange.h1),
    priceChange6h: num(priceChange.h6),
    priceChange24h: num(priceChange.h24),
    txns5mBuys: nonNegativeNum(txns.m5?.buys),
    txns5mSells: nonNegativeNum(txns.m5?.sells),
    txns1hBuys: nonNegativeNum(txns.h1?.buys),
    txns1hSells: nonNegativeNum(txns.h1?.sells),
    txns6hBuys: nonNegativeNum(txns.h6?.buys),
    txns6hSells: nonNegativeNum(txns.h6?.sells),
    txns24hBuys: nonNegativeNum(txns.h24?.buys),
    txns24hSells: nonNegativeNum(txns.h24?.sells),
    pairAddress: str(pair?.pairAddress),
    dexId: str(pair?.dexId, "unknown"),
    quoteTokenAddress: str(quote.address) || undefined,
    quoteTokenSymbol: str(quote.symbol) || undefined,
    pairCreatedAt: num(pair?.pairCreatedAt),
    url: str(pair?.url),
    updatedAt: new Date().toISOString(),
    primaryMarketSource: "DexScreener",
    marketDataSources: ["DexScreener"]
  };
}

export function normalizeGeckoPool(pool: any): TokenSnapshot {
  const attrs = pool?.attributes ?? {};
  const relToken = pool?.relationships?.base_token?.data?.id ?? "";
  const tokenAddress = String(relToken).split("_").pop() || attrs.address || pool?.id;
  const volume = attrs.volume_usd ?? {};
  const change = attrs.price_change_percentage ?? {};
  const txns = attrs.transactions ?? {};

  return {
    chainId: BASE_CHAIN_ID,
    tokenAddress,
    symbol: str(attrs.name?.split("/")?.[0]?.trim(), "POOL"),
    name: str(attrs.name, "Gecko Pool"),
    priceUsd: positiveNum(attrs.base_token_price_usd ?? attrs.quote_token_price_usd),
    fdv: positiveNum(attrs.fdv_usd),
    marketCap: positiveNum(attrs.market_cap_usd),
    liquidityUsd: nonNegativeNum(attrs.reserve_in_usd),
    volume5m: nonNegativeNum(volume.m5),
    volume1h: nonNegativeNum(volume.h1),
    volume6h: nonNegativeNum(volume.h6),
    volume24h: nonNegativeNum(volume.h24),
    priceChange5m: num(change.m5),
    priceChange1h: num(change.h1),
    priceChange6h: num(change.h6),
    priceChange24h: num(change.h24),
    txns5mBuys: nonNegativeNum(txns.m5?.buys),
    txns5mSells: nonNegativeNum(txns.m5?.sells),
    txns1hBuys: nonNegativeNum(txns.h1?.buys),
    txns1hSells: nonNegativeNum(txns.h1?.sells),
    txns6hBuys: nonNegativeNum(txns.h6?.buys),
    txns6hSells: nonNegativeNum(txns.h6?.sells),
    txns24hBuys: nonNegativeNum(txns.h24?.buys),
    txns24hSells: nonNegativeNum(txns.h24?.sells),
    pairAddress: str(attrs.address, String(pool?.id ?? "").split("_").pop()),
    dexId: str(attrs.dex_id, "geckoterminal"),
    pairCreatedAt: attrs.pool_created_at ? new Date(attrs.pool_created_at).getTime() : null,
    url: `https://www.geckoterminal.com/base/pools/${str(attrs.address, String(pool?.id ?? "").split("_").pop())}`,
    updatedAt: new Date().toISOString(),
    primaryMarketSource: "GeckoTerminal",
    marketDataSources: ["GeckoTerminal"]
  };
}

export function mergeTokenSnapshots(tokens: TokenSnapshot[]): TokenSnapshot[] {
  const map = new Map<string, TokenSnapshot>();
  for (const token of tokens) {
    const key = `${token.tokenAddress.toLowerCase()}-${token.pairAddress.toLowerCase()}`;
    const previous = map.get(key);
    if (!previous || Number(token.liquidityUsd ?? 0) > Number(previous.liquidityUsd ?? 0)) {
      map.set(key, token);
    }
  }
  return Array.from(map.values());
}
