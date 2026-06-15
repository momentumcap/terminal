import { getOnchainTokenMetadata, type OnchainTokenMetadata } from "@/lib/onchain/erc20";
import { ethCall, normalizeAddress, strip0x } from "@/lib/onchain/baseRpc";
import { discoverUniswapV3Pools, indexUniswapV3BuySellWindows, inspectKnownUniswapPool, BASE_USDC, BASE_WETH, type OwnPool, type OwnTransactionWindow } from "@/lib/onchain/uniswapV3";
import { summarizeTransfers24h, type TransferWindowSummary } from "@/lib/onchain/tokenTransfers";

export type KnownPairInput = string | { pairAddress: string; dexId?: string; quoteTokenAddress?: string; quoteTokenSymbol?: string };

export interface OwnOnchainSnapshot {
  token: OnchainTokenMetadata;
  pools: OwnPool[];
  primaryPool: OwnPool | null;
  transactionWindows: OwnTransactionWindow[];
  transfers: TransferWindowSummary | null;
  source: "BaseRPC";
  updatedAt: string;
}

export async function getOwnOnchainSnapshot(address: string, knownPairAddresses: KnownPairInput | KnownPairInput[] = []): Promise<OwnOnchainSnapshot> {
  const pairInputs = Array.isArray(knownPairAddresses) ? knownPairAddresses : knownPairAddresses ? [knownPairAddresses] : [];
  const pairAddresses = pairInputs.map((pair) => typeof pair === "string" ? pair : pair.pairAddress);
  const [token, discoveredPools, inspectedKnownPairs, transfers] = await Promise.all([
    getOnchainTokenMetadata(address),
    discoverUniswapV3Pools(address).catch(() => []),
    Promise.all(pairAddresses.map((pairAddress) => inspectKnownUniswapPool(pairAddress, address))),
    withDeadline(summarizeTransfers24h(address), null, 1_200)
  ]);
  const fallbackKnownPairs = await Promise.all(pairAddresses.map((pairAddress, index) => inspectedKnownPairs[index] ? null : inspectPairTokensOnly(pairAddress, address)));
  const hintedPairs = pairInputs.map((pair) => typeof pair === "string" ? null : buildHintedPool(pair, address));
  const pools = dedupePools([...inspectedKnownPairs, ...hintedPairs, ...fallbackKnownPairs, ...discoveredPools].filter(Boolean) as OwnPool[]);
  const indexed = await indexBestCompletePool(address, pools);
  const primaryPool = indexed.primaryPool;
  const transactionWindows = indexed.transactionWindows;
  return { token, pools, primaryPool, transactionWindows, transfers, source: "BaseRPC", updatedAt: new Date().toISOString() };
}

function buildHintedPool(pair: Exclude<KnownPairInput, string>, tokenAddress: string): OwnPool | null {
  if (!pair.pairAddress || !pair.quoteTokenAddress) return null;
  const token = normalizeAddress(tokenAddress);
  const quoteAddress = normalizeAddress(pair.quoteTokenAddress);
  const [token0, token1] = BigInt(token) < BigInt(quoteAddress) ? [token, quoteAddress] : [quoteAddress, token];
  const usdc = normalizeAddress(BASE_USDC);
  const weth = normalizeAddress(BASE_WETH);
  return {
    protocol: pair.dexId?.toLowerCase().includes("uniswap") ? "uniswap_v3" : "uniswap_v2",
    address: normalizeAddress(pair.pairAddress),
    token0,
    token1,
    quoteToken: quoteAddress === usdc ? "USDC" : quoteAddress === weth ? "WETH" : "OTHER",
    quoteAddress
  };
}

async function withDeadline<T>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function indexBestCompletePool(address: string, pools: OwnPool[]) {
  let firstAttempt: { primaryPool: OwnPool | null; transactionWindows: OwnTransactionWindow[] } = { primaryPool: pools[0] ?? null, transactionWindows: [] };
  for (const pool of pools) {
    const transactionWindows = await indexUniswapV3BuySellWindows(address, pool).catch(() => []);
    if (!firstAttempt.transactionWindows.length) firstAttempt = { primaryPool: pool, transactionWindows };
    if (transactionWindows.some((window) => window.complete)) return { primaryPool: pool, transactionWindows };
  }
  return firstAttempt;
}

async function inspectPairTokensOnly(poolAddress: string | undefined, tokenAddress: string): Promise<OwnPool | null> {
  if (!poolAddress) return null;
  try {
    const [token0Result, token1Result] = await Promise.all([
      ethCall(poolAddress, "0x0dfe1681"),
      ethCall(poolAddress, "0xd21220a7")
    ]);
    const token0 = normalizeAddress(`0x${strip0x(token0Result).slice(-40)}`);
    const token1 = normalizeAddress(`0x${strip0x(token1Result).slice(-40)}`);
    const token = normalizeAddress(tokenAddress);
    if (token0 !== token && token1 !== token) return null;
    const quoteAddress = token0 === token ? token1 : token0;
    const usdc = normalizeAddress(BASE_USDC);
    const weth = normalizeAddress(BASE_WETH);
    return {
      protocol: "uniswap_v2",
      address: normalizeAddress(poolAddress),
      token0,
      token1,
      quoteToken: quoteAddress === usdc ? "USDC" : quoteAddress === weth ? "WETH" : "OTHER",
      quoteAddress
    };
  } catch {
    return null;
  }
}

function dedupePools(pools: OwnPool[]) {
  const seen = new Set<string>();
  return pools.filter((pool) => {
    const key = pool.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
